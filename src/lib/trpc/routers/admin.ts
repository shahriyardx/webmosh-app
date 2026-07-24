import { z } from "zod"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import {
  CompanyStatus,
  DocumentStatus,
  ExchangeTxStatus,
  PaymentStatus,
  PayoutStatus,
  ServiceOrderStatus,
  TaskStatus,
  TicketStatus,
  WalletTxStatus,
} from "@/generated/prisma/enums"
import { getCompaniesHouseDates } from "@/lib/companies-house"

/** Bucket a date-diff (in days from now) into overdue/30/60/90. */
function bucketByDays(days: number): "overdue" | "d30" | "d60" | "d90" {
  if (days < 0) return "overdue"
  if (days <= 30) return "d30"
  if (days <= 60) return "d60"
  return "d90"
}

/** Ticket priority derived from status + age (no schema change required). */
function ticketPriority(t: {
  status: TicketStatus
  createdAt: Date
  updatedAt: Date
}): "high" | "medium" | "low" {
  if (t.status !== TicketStatus.open) return "low"
  const ageHours = (Date.now() - new Date(t.updatedAt).getTime()) / 36e5
  if (ageHours >= 24) return "high"
  const totalAgeHours = (Date.now() - new Date(t.createdAt).getTime()) / 36e5
  if (totalAgeHours >= 4) return "medium"
  return "low"
}

export const adminRouter = router({
  /**
   * Counts of items needing admin attention per sidebar section. One query,
   * polled by the admin sidebar to render the badge next to each tab.
   */
  actionCounts: adminProcedure.query(async () => {
    const [
      formations,
      wordpress,
      orders,
      tickets,
      freelancers,
      discussions,
      payouts,
      invoices,
      wallet,
      exchange,
    ] = await Promise.all([
      prisma.organization.count({
        where: {
          deletedAt: null,
          type: "company",
          status: CompanyStatus.pending,
        },
      }),
      prisma.serviceOrder.count({
        where: { service: { type: "wordpress" }, tasks: { none: {} } },
      }),
      prisma.serviceOrder.count({
        where: {
          status: {
            in: [ServiceOrderStatus.pending, ServiceOrderStatus.awaiting_quote],
          },
        },
      }),
      prisma.ticket.count({ where: { status: TicketStatus.open } }),
      prisma.task.count({ where: { status: TaskStatus.in_review } }),
      prisma.taskMessage.count({
        where: { fromAdmin: false, readByAdmin: false },
      }),
      prisma.payout.count({ where: { status: PayoutStatus.pending } }),
      prisma.invoice.count({
        where: { deletedAt: null, status: PaymentStatus.processing },
      }),
      prisma.walletTransaction.count({
        where: { status: WalletTxStatus.pending },
      }),
      prisma.exchangeTransaction.count({
        where: { status: ExchangeTxStatus.pending },
      }),
    ])
    return {
      formations,
      wordpress,
      orders,
      tickets,
      freelancers,
      discussions,
      payouts,
      invoices,
      wallet,
      exchange,
    }
  }),

  /**
   * 1. Compliance deadline tracker — companies with confirmation-statement or
   *    annual-accounts filings due in the next 90 days, bucketed by urgency.
   *    Enriches UK companies with live Companies House dates.
   */
  complianceDeadlines: adminProcedure.query(async () => {
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null, type: "company" },
      select: {
        id: true,
        name: true,
        country: true,
        companyId: true,
        status: true,
        confirmationStatementDue: true,
        accountsFilingDue: true,
      },
    })

    // Enrich UK companies with live CH dates (only when DB is missing them).
    const enriched = await Promise.all(
      orgs.map(async (o) => {
        if (
          o.country !== "uk" ||
          !o.companyId ||
          (o.confirmationStatementDue && o.accountsFilingDue)
        ) {
          return o
        }
        const dates = await getCompaniesHouseDates(o.companyId).catch(() => null)
        if (!dates) return o
        return {
          ...o,
          confirmationStatementDue:
            o.confirmationStatementDue ??
            (dates.confirmationNextDue
              ? new Date(dates.confirmationNextDue)
              : null),
          accountsFilingDue:
            o.accountsFilingDue ??
            (dates.accountsNextDue ? new Date(dates.accountsNextDue) : null),
        }
      }),
    )

    type Bucket = "overdue" | "d30" | "d60" | "d90"
    type Kind = "confirmation" | "accounts"
    const items: {
      orgId: string
      orgName: string
      country: string | null
      kind: Kind
      due: Date
      days: number
      bucket: Bucket
    }[] = []

    for (const o of enriched) {
      for (const [kind, due] of [
        ["confirmation", o.confirmationStatementDue],
        ["accounts", o.accountsFilingDue],
      ] as [Kind, Date | null][]) {
        if (!due) continue
        const days = Math.floor(
          (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
        if (days > 90) continue
        items.push({
          orgId: o.id,
          orgName: o.name,
          country: o.country ?? null,
          kind,
          due: new Date(due),
          days,
          bucket: bucketByDays(days),
        })
      }
    }

    items.sort((a, b) => a.days - b.days)

    const counts = {
      overdue: items.filter((i) => i.bucket === "overdue").length,
      d30: items.filter((i) => i.bucket === "d30").length,
      d60: items.filter((i) => i.bucket === "d60").length,
      d90: items.filter((i) => i.bucket === "d90").length,
    }
    return { items, counts }
  }),

  /** Documents awaiting admin review (status = submitted). */
  docsToReview: adminProcedure.query(async () => {
    const docs = await prisma.document.findMany({
      where: { status: DocumentStatus.submitted },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        name: true,
        value: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            directors: {
              select: { firstName: true, lastName: true },
              take: 3,
            },
          },
        },
      },
    })
    return docs.map((d) => ({
      ...d,
      directorNames: d.organization?.directors
        .map((dir) => `${dir.firstName} ${dir.lastName}`.trim())
        .filter(Boolean),
    }))
  }),

  /**
   * Prioritized invoice feed for the dashboard.
   * Order: processing (verify now) → rejected → unpaid → paid, then newest first.
   * Returns latest 8 across all statuses.
   */
  invoicesToReview: adminProcedure.query(async () => {
    const invoices = await prisma.invoice.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        number: true,
        amount: true,
        description: true,
        status: true,
        paymentMethod: true,
        transactionId: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            members: {
              where: { role: "owner" },
              take: 1,
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
    })
    const priority: Record<string, number> = {
      processing: 0,
      rejected: 1,
      unpaid: 2,
      paid: 3,
    }
    const sorted = invoices
      .map((inv) => ({
        ...inv,
        owner: inv.organization?.members?.[0]?.user ?? null,
      }))
      .sort((a, b) => {
        const diff =
          (priority[a.status] ?? 9) - (priority[b.status] ?? 9)
        if (diff !== 0) return diff
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
    return sorted.slice(0, 4)
  }),

  /** Recent orders — most-recent service orders across all clients. */
  recentOrders: adminProcedure.query(async () => {
    const orders = await prisma.serviceOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        status: true,
        createdAt: true,
        service: { select: { title: true } },
        organization: { select: { id: true, name: true } },
      },
    })
    return orders
  }),

  /** Recent tickets across all clients with derived priority. */
  recentTickets: adminProcedure.query(async () => {
    const tickets = await prisma.ticket.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
    })
    return tickets.map((t) => ({
      ...t,
      priority: ticketPriority(t),
    }))
  }),

  /**
   * 5. Recent activity — synthesized from updated timestamps across the core
   *    tables. Not a strict audit log (no actor attribution) but reflects
   *    everything that has recently changed.
   */
  recentActivity: adminProcedure.query(async () => {
    const [orgs, docs, invoices, orders, tickets] = await Promise.all([
      prisma.organization.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.document.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          amount: true,
          status: true,
          updatedAt: true,
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.serviceOrder.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          serviceId: true,
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.ticket.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          subject: true,
          status: true,
          updatedAt: true,
        },
      }),
    ])

    type Entry = {
      id: string
      when: Date
      kind: "formation" | "document" | "invoice" | "order" | "ticket"
      title: string
      subtitle: string
      href: string
      status: string
    }
    const entries: Entry[] = []
    for (const o of orgs) {
      entries.push({
        id: `org-${o.id}`,
        when: o.createdAt,
        kind: "formation",
        title: o.name,
        subtitle: "Formation submitted",
        href: `/admin/formations/${o.id}`,
        status: o.status,
      })
    }
    for (const d of docs) {
      entries.push({
        id: `doc-${d.id}`,
        when: d.updatedAt,
        kind: "document",
        title: d.name,
        subtitle: `Document · ${d.organization?.name ?? "—"}`,
        href: d.organization
          ? `/admin/formations/${d.organization.id}`
          : "/admin/formations",
        status: d.status,
      })
    }
    for (const inv of invoices) {
      entries.push({
        id: `inv-${inv.id}`,
        when: inv.updatedAt,
        kind: "invoice",
        title: `$${inv.amount} · ${inv.organization?.name ?? "—"}`,
        subtitle: "Invoice",
        href: "/admin/invoices",
        status: inv.status,
      })
    }
    for (const so of orders) {
      entries.push({
        id: `ord-${so.id}`,
        when: so.updatedAt,
        kind: "order",
        title: so.organization?.name ?? "Order",
        subtitle: "Service order",
        href: "/admin/orders",
        status: so.status,
      })
    }
    for (const t of tickets) {
      entries.push({
        id: `tkt-${t.id}`,
        when: t.updatedAt,
        kind: "ticket",
        title: t.subject,
        subtitle: "Support ticket",
        href: `/admin/tickets/${t.id}`,
        status: t.status,
      })
    }

    entries.sort((a, b) => b.when.getTime() - a.when.getTime())
    return entries.slice(0, 12)
  }),

  /**
   * 6. Task manager — combines new company orders (pending formations +
   *    pending service orders) and open tickets, sorted by priority.
   */
  taskManager: adminProcedure.query(async () => {
    const [pendingFormations, pendingOrders, openTickets] = await Promise.all([
      prisma.organization.findMany({
        where: {
          deletedAt: null,
          type: "company",
          status: CompanyStatus.pending,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          country: true,
          createdAt: true,
        },
      }),
      prisma.serviceOrder.findMany({
        where: { status: ServiceOrderStatus.pending },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.ticket.findMany({
        where: { status: TicketStatus.open },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          subject: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { name: true } },
        },
      }),
    ])

    type Task = {
      id: string
      kind: "formation" | "order" | "ticket"
      title: string
      subtitle: string
      priority: "high" | "medium" | "low"
      href: string
      createdAt: Date
    }
    const tasks: Task[] = []
    const now = Date.now()
    const days = (d: Date) => (now - new Date(d).getTime()) / 864e5

    for (const f of pendingFormations) {
      const age = days(f.createdAt)
      const priority = age >= 2 ? "high" : age >= 1 ? "medium" : "low"
      tasks.push({
        id: `formation-${f.id}`,
        kind: "formation",
        title: f.name,
        subtitle: `New company · ${f.country?.toUpperCase() ?? "—"}`,
        priority,
        href: `/admin/formations/${f.id}`,
        createdAt: f.createdAt,
      })
    }
    for (const o of pendingOrders) {
      const age = days(o.createdAt)
      const priority = age >= 2 ? "high" : age >= 1 ? "medium" : "low"
      tasks.push({
        id: `order-${o.id}`,
        kind: "order",
        title: o.organization?.name ?? "New order",
        subtitle: "Service order awaiting action",
        priority,
        href: "/admin/orders",
        createdAt: o.createdAt,
      })
    }
    for (const t of openTickets) {
      const priority = ticketPriority(t)
      tasks.push({
        id: `ticket-${t.id}`,
        kind: "ticket",
        title: t.subject,
        subtitle: `Ticket from ${t.user?.name ?? "customer"}`,
        priority,
        href: `/admin/tickets/${t.id}`,
        createdAt: t.createdAt,
      })
    }

    const order = { high: 0, medium: 1, low: 2 }
    tasks.sort(
      (a, b) =>
        order[a.priority] - order[b.priority] ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )
    return tasks.slice(0, 12)
  }),

  /** Lightweight list of clients + their (non-deleted) companies for pickers. */
  clientsWithCompanies: adminProcedure.query(async () => {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        members: {
          where: { organization: { deletedAt: null } },
          select: {
            organization: {
              select: { id: true, name: true, country: true },
            },
          },
        },
      },
    })
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      companies: u.members.map((m) => m.organization),
    }))
  }),

  /** Individual client profile — aggregate everything across their orgs. */
  clientProfile: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          image: true,
          role: true,
          banned: true,
          banReason: true,
          createdAt: true,
        },
      })
      if (!user) throw new Error("User not found")

      const memberships = await prisma.member.findMany({
        where: { userId: user.id, organization: { deletedAt: null } },
        select: {
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              country: true,
              status: true,
              companyId: true,
              createdAt: true,
            },
          },
        },
      })
      const orgIds = memberships.map((m) => m.organizationId)

      const [documents, invoices, orders, tickets] = await Promise.all([
        prisma.document.findMany({
          where: { organizationId: { in: orgIds } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            value: true,
            rejectReason: true,
            organization: { select: { id: true, name: true } },
          },
        }),
        prisma.invoice.findMany({
          where: { organizationId: { in: orgIds }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            amount: true,
            description: true,
            status: true,
            createdAt: true,
            organization: { select: { id: true, name: true } },
          },
        }),
        prisma.serviceOrder.findMany({
          where: { organizationId: { in: orgIds } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            status: true,
            createdAt: true,
            serviceId: true,
            organization: { select: { id: true, name: true } },
          },
        }),
        prisma.ticket.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            organization: { select: { id: true, name: true } },
          },
        }),
      ])

      const totalPaid = invoices
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + i.amount, 0)

      return {
        user,
        companies: memberships.map((m) => m.organization),
        documents,
        invoices,
        orders,
        tickets,
        totals: {
          companies: memberships.length,
          documents: documents.length,
          invoices: invoices.length,
          orders: orders.length,
          tickets: tickets.length,
          paid: totalPaid,
        },
      }
    }),

  /** Update basic client details. */
  updateClient: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { userId, ...data } = input
      return prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
        },
      })
    }),

  /** Suspend / un-suspend a client (uses Better Auth's banned column). */
  setClientSuspended: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        suspended: z.boolean(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.user.update({
        where: { id: input.userId },
        data: {
          banned: input.suspended,
          banReason: input.suspended ? input.reason ?? null : null,
          banExpires: null,
        },
        select: { id: true, banned: true, banReason: true },
      })
    }),

  /**
   * Hard-delete a client and their solo organizations.
   * Cascade rules drop sessions, members, tickets, invitations, and accounts
   * automatically. Any organization where they were the only member is soft-
   * deleted so it stops appearing in listings. Admins cannot delete themselves.
   */
  deleteClient: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new Error("You cannot delete your own account.")
      }
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true },
      })
      if (!target) throw new Error("Client not found.")
      if (target.role === "admin") {
        throw new Error(
          "Refusing to delete another admin. Demote them to user first.",
        )
      }

      // Find orgs where this user is a member. Soft-delete any org where
      // they were the sole member; leave shared orgs untouched (other
      // members lose this user but keep the company).
      const memberships = await prisma.member.findMany({
        where: { userId: input.userId },
        select: {
          organizationId: true,
          organization: {
            select: {
              id: true,
              deletedAt: true,
              _count: { select: { members: true } },
            },
          },
        },
      })
      const soloOrgIds = memberships
        .filter(
          (m) =>
            m.organization &&
            !m.organization.deletedAt &&
            m.organization._count.members === 1,
        )
        .map((m) => m.organizationId)

      await prisma.$transaction(async (tx) => {
        if (soloOrgIds.length > 0) {
          await tx.organization.updateMany({
            where: { id: { in: soloOrgIds } },
            data: { deletedAt: new Date() },
          })
        }
        await tx.user.delete({ where: { id: input.userId } })
      })

      return { ok: true, orphanedOrgs: soloOrgIds.length }
    }),
})
