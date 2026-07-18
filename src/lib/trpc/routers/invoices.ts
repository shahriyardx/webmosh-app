import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { PaymentStatus } from "@/generated/prisma/enums"
import Stripe from "stripe"
import {
  emailUserNewInvoice,
  emailUserPayment,
  emailAdminPaymentSubmitted,
  emailAdminInvoicePaid,
} from "@/lib/notify"
import { createAdminNotification } from "@/lib/notifications"

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
  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: input.organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
      return attachItemInfo(invoices)
    }),

  listForUser: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id
    const members = await prisma.member.findMany({
      where: { userId },
      select: { organizationId: true },
    })
    const orgIds = members.map((m) => m.organizationId)
    if (!orgIds.length) return []
    const [invoices, orgs] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId: { in: orgIds }, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true, type: true },
      }),
    ])
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    const enriched = await attachItemInfo(invoices)
    return enriched.map((inv) => ({ ...inv, organization: orgMap.get(inv.organizationId) ?? null }))
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.id },
      })
      if (!invoice || invoice.deletedAt) return null

      const isAdmin = ctx.user.role === "admin"
      if (!isAdmin) {
        const member = await prisma.member.findFirst({
          where: { userId: ctx.user.id, organizationId: invoice.organizationId },
          select: { id: true },
        })
        if (!member) return null
      }

      const enriched = await attachItemInfo([invoice])
      return enriched[0]
    }),

  listAll: adminProcedure
    .input(z.object({ status: z.nativeEnum(PaymentStatus).optional() }))
    .query(async ({ input }) => {
      const where = {
        deletedAt: null,
        ...(input.status ? { status: input.status } : {}),
      }
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
        paymentMethod: z.enum(["bkash", "BanglaQR"]),
        transactionId: z.string().min(1, "Transaction ID is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice) throw new Error("Invoice not found")
      await assertOrgMember(ctx.user.id, invoice.organizationId)
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new Error("Invoice is not in unpaid status")
      }

      const updated = await prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paymentMethod: input.paymentMethod,
          transactionId: input.transactionId,
          status: PaymentStatus.processing,
        },
      })

      const org = await prisma.organization.findUnique({
        where: { id: invoice.organizationId },
        select: { name: true },
      })
      await emailAdminPaymentSubmitted(
        org?.name ?? "a company",
        invoice.amount,
        input.paymentMethod,
        input.transactionId,
      ).catch(() => {})
      await createAdminNotification({
        kind: "invoice.payment_submitted",
        title: `Payment submitted: $${invoice.amount.toFixed(2)}`,
        body: `${org?.name ?? "A customer"} submitted a ${input.paymentMethod} transaction. Please verify.`,
        link: "/admin/invoices",
      })

      return updated
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
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice) throw new Error("Invoice not found")
      await assertOrgMember(ctx.user.id, invoice.organizationId)
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
        customer_email: ctx.user.email ?? undefined,
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

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      })
      if (!invoice) throw new Error("Invoice not found")
      await assertOrgMember(ctx.user.id, invoice.organizationId)

      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paymentMethod: "stripe",
          transactionId: paymentIntentId,
          status: PaymentStatus.paid,
        },
      })

      const org = await prisma.organization.findUnique({
        where: { id: updated.organizationId },
        select: { name: true },
      })
      await emailAdminInvoicePaid(org?.name ?? "a company", updated.amount).catch(() => {})
      await emailUserPayment(updated.organizationId, true, updated.amount).catch(() => {})

      return updated
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const updated = await prisma.invoice.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.paid,
          rejectReason: null,
        },
      })
      await emailUserPayment(updated.organizationId, true, updated.amount).catch(() => {})
      return updated
    }),

  reject: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const updated = await prisma.invoice.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.unpaid,
          rejectReason: input.reason,
          paymentMethod: null,
          transactionId: null,
        },
      })
      await emailUserPayment(updated.organizationId, false, updated.amount, input.reason).catch(
        () => {},
      )
      return updated
    }),

  create: adminProcedure
    .input(
      z.object({
        organizationId: z.string(),
        // Legacy path: single amount + description.
        amount: z.number().positive().optional(),
        description: z.string().optional(),
        // New path: multiple line items (title + amount each).
        items: z
          .array(
            z.object({
              title: z.string().min(1),
              amount: z.number().positive(),
            }),
          )
          .optional(),
        // Override the default recipient (org owner) with a custom name+email.
        receiverName: z.string().optional(),
        receiverEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const items = input.items ?? []
      const total = items.length
        ? items.reduce((s, i) => s + i.amount, 0)
        : input.amount ?? 0
      if (total <= 0) {
        throw new Error("Invoice must have a positive total.")
      }
      const description =
        input.description ||
        (items.length
          ? items.map((i) => `${i.title} — $${i.amount}`).join("; ")
          : null)

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: input.organizationId,
          amount: total,
          description,
          items: items.length ? items : undefined,
          receiverName: input.receiverName?.trim() || null,
          receiverEmail: input.receiverEmail?.trim() || null,
          status: PaymentStatus.unpaid,
        },
      })
      await emailUserNewInvoice(input.organizationId, invoice, {
        toEmail: input.receiverEmail ?? undefined,
        toName: input.receiverName ?? undefined,
      }).catch(() => {})
      return invoice
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.invoice.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),

  /** Re-send the invoice email as a reminder ("Reminder: …" subject). */
  sendReminder: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          amount: true,
          description: true,
          organizationId: true,
          receiverEmail: true,
          receiverName: true,
        },
      })
      if (!invoice) throw new Error("Invoice not found")
      await emailUserNewInvoice(
        invoice.organizationId,
        {
          id: invoice.id,
          amount: invoice.amount,
          description: invoice.description,
        },
        {
          toEmail: invoice.receiverEmail ?? undefined,
          toName: invoice.receiverName ?? undefined,
          reminder: true,
        },
      )
      return { ok: true }
    }),

  /**
   * Create an invoice for a client who doesn't yet exist in the system.
   * Provisions a User + Organization + Member (owner) atomically, then
   * attaches the invoice. When the client later signs in with Google using
   * the same email, better-auth links to this user, so the invoice will show
   * up on their dashboard immediately.
   */
  createForNewClient: adminProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        clientEmail: z.string().email(),
        companyName: z.string().min(1),
        items: z
          .array(
            z.object({
              title: z.string().min(1),
              amount: z.number().positive(),
            }),
          )
          .min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.user.findUnique({
        where: { email: input.clientEmail },
        select: { id: true },
      })
      if (existing) {
        throw new Error(
          `A client already exists with ${input.clientEmail}. Pick them from the existing client list instead.`,
        )
      }

      const total = input.items.reduce((s, i) => s + i.amount, 0)
      if (total <= 0) throw new Error("Invoice must have a positive total.")

      // Unique slug — retry with a numeric suffix on collision.
      const baseSlug =
        input.companyName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "company"
      let slug = baseSlug
      for (let i = 1; i < 10; i++) {
        const clash = await prisma.organization.findFirst({
          where: { slug },
          select: { id: true },
        })
        if (!clash) break
        slug = `${baseSlug}-${i}`
      }

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: crypto.randomUUID(),
            name: input.clientName,
            email: input.clientEmail,
            emailVerified: false,
            role: "user",
          },
          select: { id: true, name: true, email: true },
        })
        const org = await tx.organization.create({
          data: {
            name: input.companyName,
            slug,
            createdAt: new Date(),
          },
          select: { id: true, name: true },
        })
        await tx.member.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: "owner",
            createdAt: new Date(),
          },
        })
        const description =
          input.description ||
          input.items.map((i) => `${i.title} — $${i.amount}`).join("; ")
        const invoice = await tx.invoice.create({
          data: {
            organizationId: org.id,
            amount: total,
            description,
            items: input.items,
            receiverName: user.name,
            receiverEmail: user.email,
            status: PaymentStatus.unpaid,
          },
        })
        return { user, org, invoice }
      })

      await emailUserNewInvoice(result.org.id, result.invoice, {
        toEmail: result.user.email,
        toName: result.user.name,
      }).catch(() => {})

      return result.invoice
    }),
})
