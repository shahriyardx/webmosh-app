import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { PaymentStatus } from "@/generated/prisma/enums"
import Stripe from "stripe"

export type EnrichedInvoice = Awaited<ReturnType<typeof prisma.invoice.findMany>>[number] & {
  item: { type: "service" | "package"; title: string } | null
}

async function attachItemInfo(
  invoices: Awaited<ReturnType<typeof prisma.invoice.findMany>>,
) {
  const invoiceIds = invoices.map((i) => i.id)

  // Check for service orders
  const orders = await prisma.serviceOrder.findMany({
    where: { invoiceId: { in: invoiceIds } },
  })

  const orderMap = new Map(orders.map((o) => [o.invoiceId, o]))
  let svcMap: Map<string, { id: string; title: string }> = new Map()

  if (orders.length > 0) {
    const serviceIds = [...new Set(orders.map((o) => o.serviceId))]
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, title: true },
    })
    svcMap = new Map(services.map((s) => [s.id, s]))
  }

  // Fetch package info for non-service-order invoices
  const orgIds = [...new Set(invoices.map((i) => i.organizationId))]
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, packageId: true },
  })
  const orgMap = new Map(orgs.map((o) => [o.id, o]))

  const pkgIds = [...new Set(orgs.map((o) => o.packageId).filter(Boolean))] as string[]
  let pkgMap: Map<string, { id: string; title: string }> = new Map()
  if (pkgIds.length > 0) {
    const pkgs = await prisma.package.findMany({
      where: { id: { in: pkgIds } },
      select: { id: true, title: true },
    })
    pkgMap = new Map(pkgs.map((p) => [p.id, p]))
  }

  return invoices.map((inv) => {
    const order = orderMap.get(inv.id)
    const svc = order ? svcMap.get(order.serviceId) : undefined
    if (svc) return { ...inv, item: { type: "service" as const, title: svc.title } }

    const org = orgMap.get(inv.organizationId)
    const pkg = org?.packageId ? pkgMap.get(org.packageId) : undefined
    if (pkg) return { ...inv, item: { type: "package" as const, title: pkg.title } }

    return { ...inv, item: null }
  })
}

export const invoicesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session?.session?.activeOrganizationId
    if (!orgId) return []
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    })
    return attachItemInfo(invoices)
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.id },
      })
      if (!invoice) return null

      // User can only view their own org's invoices unless admin
      const isAdmin = ctx.session?.user?.role === "admin"
      if (invoice.organizationId !== orgId && !isAdmin) return null

      const enriched = await attachItemInfo([invoice])
      return enriched[0]
    }),

  listAll: adminProcedure
    .input(z.object({ status: z.nativeEnum(PaymentStatus).optional() }))
    .query(async ({ input }) => {
      const where = input.status ? { status: input.status } : {}
      return prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { name: true } },
        },
      })
    }),

  submitTransaction: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        paymentMethod: z.enum(["bkash"]),
        transactionId: z.string().min(1, "Transaction ID is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.organizationId !== orgId) {
        throw new Error("Invoice not found")
      }
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new Error("Invoice is not in unpaid status")
      }

      return prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paymentMethod: input.paymentMethod,
          transactionId: input.transactionId,
          status: PaymentStatus.processing,
        },
      })
    }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        successUrl: z.string(),
        cancelUrl: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.organizationId !== orgId) {
        throw new Error("Invoice not found")
      }
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new Error("Invoice is not in unpaid status")
      }

      const settings = await prisma.setting.findMany({
        where: { key: { in: ["stripe_secret_key"] } },
      })
      const secretKey = settings.find((s) => s.key === "stripe_secret_key")?.value
      if (!secretKey) throw new Error("Stripe not configured")

      // Determine product name from linked service order or package
      let productName = "Company Formation"
      const serviceOrder = await prisma.serviceOrder.findFirst({
        where: { invoiceId: input.invoiceId },
      })
      if (serviceOrder) {
        const svc = await prisma.service.findUnique({
          where: { id: serviceOrder.serviceId },
          select: { title: true },
        })
        if (svc) productName = svc.title
      } else {
        const org = await prisma.organization.findUnique({
          where: { id: invoice.organizationId },
          select: { packageId: true },
        })
        if (org?.packageId) {
          const pkg = await prisma.package.findUnique({
            where: { id: org.packageId },
            select: { title: true },
          })
          if (pkg) productName = pkg.title
        }
      }

      const stripe = new Stripe(secretKey)
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: ctx.session?.user?.email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              product_data: { name: productName },
              unit_amount: Math.round(invoice.amount * 100),
            },
          },
        ],
        metadata: { invoiceId: input.invoiceId },
        success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl,
      })

      return { url: checkout.url }
    }),

  verifyStripeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const settings = await prisma.setting.findMany({
        where: { key: { in: ["stripe_secret_key"] } },
      })
      const secretKey = settings.find((s) => s.key === "stripe_secret_key")
      if (!secretKey) throw new Error("Stripe not configured")

      const stripe = new Stripe(secretKey.value)
      const checkout = await stripe.checkout.sessions.retrieve(input.sessionId, {
        expand: ["payment_intent"],
      })

      if (checkout.payment_status !== "paid") {
        throw new Error("Payment not completed")
      }

      const paymentIntentId =
        typeof checkout.payment_intent === "object"
          ? checkout.payment_intent?.id
          : checkout.payment_intent

      if (!paymentIntentId) throw new Error("No payment intent found")

      const invoiceId = checkout.metadata?.invoiceId
      if (!invoiceId) throw new Error("No invoice ID in session")

      const orgId = ctx.session?.session?.activeOrganizationId
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      })
      if (!invoice || invoice.organizationId !== orgId) {
        throw new Error("Invoice not found")
      }

      return prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paymentMethod: "stripe",
          transactionId: paymentIntentId,
          status: PaymentStatus.paid,
        },
      })
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.invoice.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.paid,
          rejectReason: null,
        },
      })
    }),

  reject: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.invoice.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.unpaid,
          rejectReason: input.reason,
          paymentMethod: null,
          transactionId: null,
        },
      })
    }),
})
