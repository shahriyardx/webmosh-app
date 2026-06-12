import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { PaymentStatus, ServiceOrderStatus } from "@/generated/prisma/enums"

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
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session?.session?.activeOrganizationId
    if (!orgId) return []
    const orders = await prisma.serviceOrder.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    })
    return attachInvoiceAndService(orders)
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const order = await prisma.serviceOrder.findUnique({
        where: { id: input.id },
      })
      if (!order || order.organizationId !== orgId) return null
      const enriched = await attachInvoiceAndService([order])
      return enriched[0]
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
      return prisma.serviceOrder.update({
        where: { id: input.id },
        data: { status: input.status },
      })
    }),

  purchase: protectedProcedure
    .input(z.object({ serviceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      if (!orgId) throw new Error("No active organization")

      const svc = await prisma.service.findUnique({
        where: { id: input.serviceId },
      })
      if (!svc) throw new Error("Service not found")

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          amount: svc.price,
          status: PaymentStatus.unpaid,
        },
      })

      const order = await prisma.serviceOrder.create({
        data: {
          organizationId: orgId,
          serviceId: input.serviceId,
          invoiceId: invoice.id,
        },
      })

      return {
        ...order,
        invoice: { id: invoice.id, amount: invoice.amount, status: invoice.status },
        service: { id: svc.id, title: svc.title, price: svc.price },
      }
    }),
})
