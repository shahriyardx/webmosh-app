import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { TicketStatus } from "@/generated/prisma/enums"
import {
  emailAdminNewTicket,
  emailAdminTicketReply,
  emailAdminTicketClosed,
  emailUserTicketReply,
  emailUserTicketStatus,
} from "@/lib/notify"
import { createAdminNotification } from "@/lib/notifications"

export const ticketsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
        organizationId: z.string().optional(),
        attachments: z.array(z.string()).max(3).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = input.organizationId ?? null
      if (orgId) await assertOrgMember(ctx.user.id, orgId)
      const ticket = await prisma.ticket.create({
        data: {
          userId: ctx.user.id,
          organizationId: orgId,
          subject: input.subject,
          status: TicketStatus.open,
          messages: {
            create: {
              senderId: ctx.user.id,
              fromAdmin: false,
              body: input.body,
              attachments: input.attachments,
            },
          },
        },
      })
      await emailAdminNewTicket(
        ctx.user.name ?? null,
        ctx.user.email,
        ticket.id,
        input.subject,
      ).catch(() => {})
      await createAdminNotification({
        kind: "ticket.created",
        title: `New ticket: ${input.subject}`,
        body: `From ${ctx.user.name ?? ctx.user.email}.`,
        link: `/admin/tickets/${ticket.id}`,
      })
      return ticket
    }),

  list: protectedProcedure
    .input(z.object({ organizationId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const orgId = input?.organizationId
      if (orgId) await assertOrgMember(ctx.user.id, orgId)
      return prisma.ticket.findMany({
        where: {
          userId: ctx.user.id,
          ...(orgId ? { organizationId: orgId } : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          organization: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      })
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: input.id },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          user: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
      })
      if (!ticket) return null
      const isAdmin = ctx.user.role === "admin"
      if (ticket.userId !== ctx.user.id && !isAdmin) return null
      return ticket
    }),

  reply: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        body: z.string().min(1),
        attachments: z.array(z.string()).max(3).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: input.ticketId },
        include: { user: { select: { name: true, email: true } } },
      })
      if (!ticket) throw new Error("Ticket not found")
      const isAdmin = ctx.user.role === "admin"
      if (ticket.userId !== ctx.user.id && !isAdmin) {
        throw new Error("Forbidden")
      }
      if (ticket.status === TicketStatus.closed) {
        throw new Error("Ticket is closed")
      }

      await prisma.ticketMessage.create({
        data: {
          ticketId: input.ticketId,
          senderId: ctx.user.id,
          fromAdmin: isAdmin,
          body: input.body,
          attachments: input.attachments,
        },
      })

      // Admin reply → pending (awaiting user); user reply → open
      const updated = await prisma.ticket.update({
        where: { id: input.ticketId },
        data: {
          status: isAdmin ? TicketStatus.pending : TicketStatus.open,
          updatedAt: new Date(),
        },
      })

      if (isAdmin) {
        await emailUserTicketReply(
          ticket.user.email,
          ticket.user.name,
          ticket.id,
          ticket.subject,
          ticket.organizationId,
        ).catch(() => {})
      } else {
        await emailAdminTicketReply(ticket.user.name, ticket.id, ticket.subject).catch(() => {})
      }

      return updated
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: input.id },
        include: { user: { select: { name: true, email: true } } },
      })
      if (!ticket) throw new Error("Ticket not found")
      const isAdmin = ctx.user.role === "admin"
      if (ticket.userId !== ctx.user.id && !isAdmin) {
        throw new Error("Forbidden")
      }
      const updated = await prisma.ticket.update({
        where: { id: input.id },
        data: { status: TicketStatus.closed },
      })

      if (isAdmin) {
        await emailUserTicketStatus(
          ticket.user.email,
          ticket.user.name,
          ticket.id,
          ticket.subject,
          TicketStatus.closed,
          ticket.organizationId,
        ).catch(() => {})
      } else {
        await emailAdminTicketClosed(ticket.user.name, ticket.id, ticket.subject).catch(() => {})
      }

      return updated
    }),

  // Admin
  listAll: adminProcedure
    .input(z.object({ status: z.nativeEnum(TicketStatus).optional() }))
    .query(async ({ input }) => {
      return prisma.ticket.findMany({
        where: input.status ? { status: input.status } : {},
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          organization: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      })
    }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(TicketStatus) }))
    .mutation(async ({ input }) => {
      const updated = await prisma.ticket.update({
        where: { id: input.id },
        data: { status: input.status },
        include: { user: { select: { name: true, email: true } } },
      })
      await emailUserTicketStatus(
        updated.user.email,
        updated.user.name,
        updated.id,
        updated.subject,
        input.status,
        updated.organizationId,
      ).catch(() => {})
      return updated
    }),

  openCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.ticket.count({
      where: { userId: ctx.user.id, status: { not: TicketStatus.closed } },
    })
  }),

  pendingCount: protectedProcedure
    .input(z.object({ organizationId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const orgId = input?.organizationId
      if (orgId) await assertOrgMember(ctx.user.id, orgId)
      return prisma.ticket.count({
        where: {
          userId: ctx.user.id,
          status: TicketStatus.pending,
          ...(orgId ? { organizationId: orgId } : {}),
        },
      })
    }),

  adminOpenCount: adminProcedure.query(async () => {
    return prisma.ticket.count({ where: { status: TicketStatus.open } })
  }),
})
