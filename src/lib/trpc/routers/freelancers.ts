import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { emailFreelancerInvite } from "@/lib/notify"

export const freelancersRouter = router({
  list: adminProcedure.query(async () => {
    const users = await prisma.user.findMany({
      where: { role: "freelancer" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        banned: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    if (!users.length) return []

    const taskCounts = await prisma.task.groupBy({
      by: ["assignedToId", "status"],
      where: { assignedToId: { in: users.map((u) => u.id) } },
      _count: { _all: true },
    })
    const countMap = new Map<
      string,
      { total: number; open: number; done: number }
    >()
    for (const uid of users.map((u) => u.id)) {
      countMap.set(uid, { total: 0, open: 0, done: 0 })
    }
    for (const row of taskCounts) {
      const bucket = countMap.get(row.assignedToId)!
      bucket.total += row._count._all
      if (row.status === "done") bucket.done += row._count._all
      else bucket.open += row._count._all
    }

    return users.map((u) => ({
      ...u,
      tasks: countMap.get(u.id) ?? { total: 0, open: 0, done: 0 },
    }))
  }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findFirst({
        where: { id: input.id, role: "freelancer" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          address: true,
          banned: true,
          createdAt: true,
        },
      })
      if (!user) return null
      return user
    }),

  /** Pending invitations. */
  listInvites: adminProcedure.query(() =>
    prisma.freelancerInvite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ),

  invite: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase()

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      })
      if (existing?.role === "freelancer") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This person is already a freelancer.",
        })
      }
      if (existing?.role === "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot invite an admin as a freelancer.",
        })
      }

      const pending = await prisma.freelancerInvite.findFirst({
        where: { email, acceptedAt: null },
        select: { id: true },
      })
      if (pending) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation is already pending for this email.",
        })
      }

      const invite = await prisma.freelancerInvite.create({
        data: {
          email,
          invitedById: ctx.user.id,
        },
      })

      await emailFreelancerInvite(email).catch(() => {})

      return {
        id: invite.id,
        email: invite.email,
        alreadyRegistered: !!existing,
      }
    }),

  revokeInvite: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.freelancerInvite.delete({ where: { id: input.id } })
      return { ok: true }
    }),

  /** Promote an existing user directly to freelancer, no invite required. */
  promote: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true, email: true },
      })
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." })
      }
      if (target.role === "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Admins cannot be turned into freelancers.",
        })
      }
      if (target.role === "freelancer") {
        return { ok: true, alreadyFreelancer: true }
      }
      await prisma.$transaction([
        prisma.user.update({
          where: { id: target.id },
          data: { role: "freelancer" },
        }),
        prisma.freelancerInvite.updateMany({
          where: { email: target.email, acceptedAt: null },
          data: { acceptedAt: new Date() },
        }),
      ])
      return { ok: true, alreadyFreelancer: false }
    }),

  /** Turn a freelancer back into a regular user. */
  demote: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true },
      })
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." })
      }
      if (target.role !== "freelancer") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That user is not a freelancer.",
        })
      }
      await prisma.user.update({
        where: { id: target.id },
        data: { role: "user" },
      })
      return { ok: true }
    }),

  /**
   * Called by the sign-in redirect for existing users. If the signed-in
   * user's email matches a pending FreelancerInvite, promote them to
   * freelancer. Returns the (possibly updated) role so the client can
   * redirect appropriately.
   */
  claimMyInvite: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role === "freelancer") {
      return { role: "freelancer" as const, promoted: false }
    }
    if (ctx.user.role === "admin") {
      return { role: "admin" as const, promoted: false }
    }
    const invite = await prisma.freelancerInvite.findFirst({
      where: { email: ctx.user.email, acceptedAt: null },
      select: { id: true },
    })
    if (!invite) {
      return { role: ctx.user.role ?? "user", promoted: false }
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: ctx.user.id },
        data: { role: "freelancer" },
      }),
      prisma.freelancerInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ])
    return { role: "freelancer" as const, promoted: true }
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findFirst({
        where: { id: input.id, role: "freelancer" },
        select: { id: true },
      })
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Freelancer not found." })
      }
      await prisma.user.delete({ where: { id: user.id } })
      return { ok: true }
    }),
})
