import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { CompanyStatus, PaymentStatus, ServiceOrderStatus } from "@/generated/prisma/enums"
import { emailAdminNewOrder, emailUserNewInvoice, emailUserOrderStatus } from "@/lib/notify"

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

async function attachInvoiceAndService(orders: Awaited<ReturnType<typeof prisma.serviceOrder.findMany>>) {
  const invoiceIds = orders.map((o) => o.invoiceId)
  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, amount: true, status: true },
  })
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]))

  const serviceIds = [...new Set(orders.map((o) => o.serviceId))]
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, title: true, price: true },
  })
  const svcMap = new Map(services.map((s) => [s.id, s]))

  return orders.map((o) => ({
    ...o,
    invoice: invoiceMap.get(o.invoiceId) ?? null,
    service: svcMap.get(o.serviceId) ?? null,
  }))
}

export const serviceOrdersRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      const orders = await prisma.serviceOrder.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "desc" },
      })
      return attachInvoiceAndService(orders)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const order = await prisma.serviceOrder.findUnique({
        where: { id: input.id },
      })
      if (!order) return null
      const member = await prisma.member.findFirst({
        where: { userId: ctx.user.id, organizationId: order.organizationId },
        select: { id: true },
      })
      if (!member) return null
      const enriched = await attachInvoiceAndService([order])
      return enriched[0]
    }),

  listForUser: protectedProcedure.query(async ({ ctx }) => {
    const members = await prisma.member.findMany({
      where: { userId: ctx.user.id, organization: { deletedAt: null } },
      select: { organizationId: true },
    })
    const orgIds = members.map((m) => m.organizationId)
    if (!orgIds.length) return []
    const [orders, orgs] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: { organizationId: { in: orgIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      }),
    ])
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    const enriched = await attachInvoiceAndService(orders)
    return enriched.map((o) => ({ ...o, organization: orgMap.get(o.organizationId) ?? null }))
  }),

  listAll: adminProcedure.query(async () => {
    const orders = await prisma.serviceOrder.findMany({
      orderBy: { createdAt: "desc" },
    })
    return attachInvoiceAndService(orders)
  }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(ServiceOrderStatus) }))
    .mutation(async ({ input }) => {
      const updated = await prisma.serviceOrder.update({
        where: { id: input.id },
        data: { status: input.status },
      })
      const svc = await prisma.service.findUnique({
        where: { id: updated.serviceId },
        select: { title: true },
      })
      await emailUserOrderStatus(
        updated.organizationId,
        updated.id,
        svc?.title ?? "your service",
        input.status,
      ).catch(() => {})
      return updated
    }),

  purchase: protectedProcedure
    .input(z.object({ organizationId: z.string(), serviceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)

      const svc = await prisma.service.findUnique({
        where: { id: input.serviceId },
      })
      if (!svc) throw new Error("Service not found")

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: input.organizationId,
          amount: svc.price,
          status: PaymentStatus.unpaid,
        },
      })

      const order = await prisma.serviceOrder.create({
        data: {
          organizationId: input.organizationId,
          serviceId: input.serviceId,
          invoiceId: invoice.id,
        },
      })

      const org = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      })
      await emailAdminNewOrder(svc.title, org?.name ?? "a company").catch(() => {})

      return {
        ...order,
        invoice: { id: invoice.id, amount: invoice.amount, status: invoice.status },
        service: { id: svc.id, title: svc.title, price: svc.price },
      }
    }),

  /**
   * Onboarding-only: for a user without a company, purchase 1+ services and
   * create the personal account they'll be attached to. Returns the invoice
   * so the client can redirect them to the payment page.
   */
  checkoutPersonal: protectedProcedure
    .input(z.object({ serviceIds: z.array(z.string()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const services = await prisma.service.findMany({
        where: { id: { in: input.serviceIds } },
        select: { id: true, title: true, price: true },
      })
      if (services.length !== input.serviceIds.length) {
        throw new Error("One or more services could not be found.")
      }

      // Get or create the user's personal org.
      const existing = await prisma.member.findFirst({
        where: {
          userId: ctx.user.id,
          organization: { type: "personal", deletedAt: null },
        },
        select: { organizationId: true },
      })
      let organizationId: string
      if (existing) {
        organizationId = existing.organizationId
      } else {
        const name = ctx.user.name?.trim() || "My Account"
        const slug = `${slugify(name) || "account"}-${ctx.user.id.slice(-6)}`
        const org = await auth.api.createOrganization({
          body: { name, slug },
          headers: await headers(),
        })
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            country: "uk",
            type: "personal",
            status: CompanyStatus.completed,
          },
        })
        organizationId = org.id
      }

      const items = services.map((s) => ({ title: s.title, amount: s.price }))
      const total = items.reduce((sum, i) => sum + i.amount, 0)
      const description = services.map((s) => s.title).join(", ")

      const invoice = await prisma.invoice.create({
        data: {
          organizationId,
          amount: total,
          description,
          items,
          status: PaymentStatus.unpaid,
        },
      })

      for (const svc of services) {
        await prisma.serviceOrder.create({
          data: {
            organizationId,
            serviceId: svc.id,
            invoiceId: invoice.id,
          },
        })
      }

      await emailUserNewInvoice(organizationId, {
        id: invoice.id,
        amount: invoice.amount,
        description: invoice.description,
      }).catch(() => {})

      return {
        organizationId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        amount: invoice.amount,
        items,
      }
    }),
})
