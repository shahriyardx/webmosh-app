import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { TicketStatus } from "@/generated/prisma/enums"

export const ticketsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
        attachments: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return prisma.ticket.create({
        data: {
          userId: ctx.user.id,
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
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return prisma.ticket.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: "desc" },
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
        attachments: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: input.ticketId },
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
      return prisma.ticket.update({
        where: { id: input.ticketId },
        data: {
          status: isAdmin ? TicketStatus.pending : TicketStatus.open,
          updatedAt: new Date(),
        },
      })
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ticket = await prisma.ticket.findUnique({ where: { id: input.id } })
      if (!ticket) throw new Error("Ticket not found")
      const isAdmin = ctx.user.role === "admin"
      if (ticket.userId !== ctx.user.id && !isAdmin) {
        throw new Error("Forbidden")
      }
      return prisma.ticket.update({
        where: { id: input.id },
        data: { status: TicketStatus.closed },
      })
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
          _count: { select: { messages: true } },
        },
      })
    }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(TicketStatus) }))
    .mutation(async ({ input }) => {
      return prisma.ticket.update({
        where: { id: input.id },
        data: { status: input.status },
      })
    }),

  openCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.ticket.count({
      where: { userId: ctx.user.id, status: { not: TicketStatus.closed } },
    })
  }),

  adminOpenCount: adminProcedure.query(async () => {
    return prisma.ticket.count({ where: { status: TicketStatus.open } })
  }),
})
