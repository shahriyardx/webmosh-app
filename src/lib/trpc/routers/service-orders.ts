import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { CompanyStatus, PaymentStatus, ServiceOrderStatus } from "@/generated/prisma/enums"
import { emailAdminNewOrder, emailUserNewInvoice, emailUserOrderStatus } from "@/lib/notify"
import { createAdminNotification } from "@/lib/notifications"

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

async function getOrCreatePersonalOrg(user: { id: string; name?: string | null }) {
  const existing = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organization: { type: "personal", deletedAt: null },
    },
    select: { organizationId: true },
  })
  if (existing) return existing.organizationId

  const name = user.name?.trim() || "My Account"
  const slug = `${slugify(name) || "account"}-${user.id.slice(-6)}`
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
  return org.id
}

const wordpressInputSchema = z
  .object({
    mode: z.enum(["demo", "custom"]),
    themeId: z.string().optional(),
    customDesignUrl: z.string().url().optional(),
    credentials: z.object({
      cpanel: z
        .object({
          url: z.string().optional(),
          username: z.string().optional(),
          password: z.string().optional(),
        })
        .optional(),
      wpAdmin: z
        .object({
          url: z.string().optional(),
          username: z.string().optional(),
          password: z.string().optional(),
        })
        .optional(),
    }),
    contact: z.object({
      company: z.string().min(1),
      address: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(1),
    }),
  })
  .optional()

type WordpressInput = z.infer<typeof wordpressInputSchema>

async function purchaseServiceCore({
  organizationId,
  serviceId,
  wordpress,
}: {
  organizationId: string
  serviceId: string
  wordpress: WordpressInput
}) {
  const svc = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!svc) throw new Error("Service not found")

  const isWordpress = svc.type === "wordpress"
  if (isWordpress && !wordpress) {
    throw new Error("WordPress details are required for this service")
  }
  if (wordpress?.mode === "demo" && !wordpress.themeId) {
    throw new Error("Please select a demo theme")
  }
  if (wordpress?.mode === "custom" && !wordpress.customDesignUrl) {
    throw new Error("Please provide a design URL or Figma link")
  }

  const hasCpanelCreds =
    !!wordpress?.credentials?.cpanel?.url ||
    !!wordpress?.credentials?.cpanel?.username ||
    !!wordpress?.credentials?.cpanel?.password
  const hasWpCreds =
    !!wordpress?.credentials?.wpAdmin?.url ||
    !!wordpress?.credentials?.wpAdmin?.username ||
    !!wordpress?.credentials?.wpAdmin?.password
  if (isWordpress && !hasCpanelCreds && !hasWpCreds) {
    throw new Error("Please provide cPanel or WP-admin access details")
  }

  const isCustomAwaitingQuote = isWordpress && wordpress?.mode === "custom"

  let invoiceId: string | null = null
  let invoicePayload: {
    id: string
    number: number
    amount: number
    status: PaymentStatus
  } | null = null
  if (!isCustomAwaitingQuote) {
    const invoice = await prisma.invoice.create({
      data: {
        organizationId,
        amount: svc.price,
        description: svc.title,
        items: [{ title: svc.title, amount: svc.price }],
        status: PaymentStatus.unpaid,
      },
    })
    invoiceId = invoice.id
    invoicePayload = {
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount,
      status: invoice.status,
    }
  }

  const order = await prisma.serviceOrder.create({
    data: {
      organizationId,
      serviceId,
      invoiceId,
      status: isCustomAwaitingQuote
        ? ServiceOrderStatus.awaiting_quote
        : ServiceOrderStatus.pending,
      themeId: wordpress?.themeId ?? null,
      customDesignUrl: wordpress?.customDesignUrl ?? null,
      credentials: wordpress?.credentials ?? undefined,
      contactCompany: wordpress?.contact.company ?? null,
      contactAddress: wordpress?.contact.address ?? null,
      contactEmail: wordpress?.contact.email ?? null,
      contactPhone: wordpress?.contact.phone ?? null,
    },
  })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  await emailAdminNewOrder(svc.title, org?.name ?? "a company").catch(() => {})
  await createAdminNotification({
    kind: "order.placed",
    title: `New order: ${svc.title}`,
    body: `${org?.name ?? "A customer"} placed an order.`,
    link: "/admin/orders",
  })

  if (invoicePayload) {
    await emailUserNewInvoice(organizationId, {
      id: invoicePayload.id,
      amount: invoicePayload.amount,
      description: svc.title,
    }).catch(() => {})
  }

  return {
    ...order,
    invoice: invoicePayload,
    service: { id: svc.id, title: svc.title, price: svc.price, type: svc.type },
  }
}

async function attachInvoiceAndService(orders: Awaited<ReturnType<typeof prisma.serviceOrder.findMany>>) {
  const invoiceIds = orders
    .map((o) => o.invoiceId)
    .filter((id): id is string => !!id)
  const invoices = invoiceIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, number: true, amount: true, status: true },
      })
    : []
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]))

  const serviceIds = [...new Set(orders.map((o) => o.serviceId))]
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, title: true, price: true, type: true },
  })
  const svcMap = new Map(services.map((s) => [s.id, s]))

  const themeIds = [
    ...new Set(orders.map((o) => o.themeId).filter((id): id is string => !!id)),
  ]
  const themes = themeIds.length
    ? await prisma.theme.findMany({
        where: { id: { in: themeIds } },
        select: { id: true, title: true, image: true, demoUrl: true },
      })
    : []
  const themeMap = new Map(themes.map((t) => [t.id, t]))

  return orders.map((o) => ({
    ...o,
    invoice: (o.invoiceId && invoiceMap.get(o.invoiceId)) || null,
    service: svcMap.get(o.serviceId) ?? null,
    theme: (o.themeId && themeMap.get(o.themeId)) || null,
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
    .input(
      z.object({
        organizationId: z.string(),
        serviceId: z.string(),
        wordpress: wordpressInputSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      return purchaseServiceCore({
        organizationId: input.organizationId,
        serviceId: input.serviceId,
        wordpress: input.wordpress,
      })
    }),

  /**
   * Onboarding-only: purchase one service (typically WordPress) without
   * requiring a formed company. Provisions a personal org on the fly.
   */
  purchaseAsPersonal: protectedProcedure
    .input(
      z.object({
        serviceId: z.string(),
        wordpress: wordpressInputSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const organizationId = await getOrCreatePersonalOrg(ctx.user)
      return purchaseServiceCore({
        organizationId,
        serviceId: input.serviceId,
        wordpress: input.wordpress,
      })
    }),

  /** Admin: issue a quoted invoice for a custom WordPress order awaiting quote. */
  quoteCustomOrder: adminProcedure
    .input(
      z.object({
        orderId: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const order = await prisma.serviceOrder.findUnique({
        where: { id: input.orderId },
      })
      if (!order) throw new Error("Order not found")
      if (order.invoiceId) throw new Error("Order already has an invoice")

      const svc = await prisma.service.findUnique({
        where: { id: order.serviceId },
        select: { title: true },
      })
      const description =
        input.description?.trim() ||
        (svc?.title
          ? `${svc.title} — custom design quote`
          : "Custom design quote")

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: order.organizationId,
          amount: input.amount,
          description,
          items: [{ title: description, amount: input.amount }],
          status: PaymentStatus.unpaid,
        },
      })

      const updated = await prisma.serviceOrder.update({
        where: { id: order.id },
        data: {
          invoiceId: invoice.id,
          status: ServiceOrderStatus.pending,
        },
      })

      await emailUserNewInvoice(order.organizationId, {
        id: invoice.id,
        amount: invoice.amount,
        description: invoice.description,
      }).catch(() => {})

      return {
        ...updated,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          amount: invoice.amount,
          status: invoice.status,
        },
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
        select: { id: true, title: true, price: true, type: true },
      })
      if (services.length !== input.serviceIds.length) {
        throw new Error("One or more services could not be found.")
      }
      if (services.some((s) => s.type === "wordpress")) {
        throw new Error(
          "WordPress services must be checked out individually with theme + hosting details.",
        )
      }

      const organizationId = await getOrCreatePersonalOrg(ctx.user)

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
