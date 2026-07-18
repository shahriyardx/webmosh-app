import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  adminProcedure,
  freelancerProcedure,
  router,
} from "../server"
import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/notifications"
import { PayoutStatus, TaskStatus } from "@/generated/prisma/enums"

const bankDetailsSchema = z.object({
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  bankName: z.string().min(1),
  routingNumber: z.string().optional(),
  swift: z.string().optional(),
  iban: z.string().optional(),
  branch: z.string().optional(),
})

/**
 * Compute available balance for a freelancer:
 *  earned (sum of payoutAmount on done tasks)
 *  minus approved payouts (already paid out)
 *  minus pending payouts (locked while under review)
 */
async function computeBalance(freelancerId: string) {
  const [earnedAgg, approvedAgg, pendingAgg] = await Promise.all([
    prisma.task.aggregate({
      where: { assignedToId: freelancerId, status: TaskStatus.done },
      _sum: { payoutAmount: true },
    }),
    prisma.payout.aggregate({
      where: { freelancerId, status: PayoutStatus.approved },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { freelancerId, status: PayoutStatus.pending },
      _sum: { amount: true },
    }),
  ])
  const earned = earnedAgg._sum.payoutAmount ?? 0
  const paidOut = approvedAgg._sum.amount ?? 0
  const requested = pendingAgg._sum.amount ?? 0
  const available = Math.max(0, earned - paidOut - requested)
  return { earned, paidOut, requested, available }
}

export const payoutsRouter = router({
  myList: freelancerProcedure.query(({ ctx }) =>
    prisma.payout.findMany({
      where: { freelancerId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        note: true,
        adminNote: true,
        decidedAt: true,
        createdAt: true,
      },
    }),
  ),

  myBalance: freelancerProcedure.query(({ ctx }) =>
    computeBalance(ctx.user.id),
  ),

  request: freelancerProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        method: z.string().min(1),
        bankDetails: bankDetailsSchema,
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const balance = await computeBalance(ctx.user.id)
      if (input.amount > balance.available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Requested amount exceeds your available balance ($${balance.available.toFixed(
            2,
          )}).`,
        })
      }
      const payout = await prisma.payout.create({
        data: {
          freelancerId: ctx.user.id,
          amount: input.amount,
          method: input.method,
          bankDetails: input.bankDetails,
          note: input.note?.trim() || null,
        },
      })
      await createAdminNotification({
        kind: "payout.requested",
        title: `Payout request: $${input.amount.toFixed(2)}`,
        body: `${ctx.user.name ?? ctx.user.email} requested a ${input.method} payout.`,
        link: "/admin/payouts",
      })
      return payout
    }),

  cancelMine: freelancerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const p = await prisma.payout.findUnique({
        where: { id: input.id },
        select: { freelancerId: true, status: true },
      })
      if (!p || p.freelancerId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (p.status !== PayoutStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be cancelled.",
        })
      }
      await prisma.payout.delete({ where: { id: input.id } })
      return { ok: true }
    }),

  listAll: adminProcedure
    .input(
      z
        .object({
          status: z.nativeEnum(PayoutStatus).optional(),
        })
        .optional(),
    )
    .query(({ input }) =>
      prisma.payout.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          bankDetails: true,
          note: true,
          adminNote: true,
          decidedAt: true,
          createdAt: true,
          freelancer: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
    ),

  approve: adminProcedure
    .input(z.object({ id: z.string(), adminNote: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const p = await prisma.payout.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!p) throw new TRPCError({ code: "NOT_FOUND" })
      if (p.status !== PayoutStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending payouts can be approved.",
        })
      }
      return prisma.payout.update({
        where: { id: input.id },
        data: {
          status: PayoutStatus.approved,
          decidedAt: new Date(),
          decidedById: ctx.user.id,
          adminNote: input.adminNote?.trim() || null,
        },
      })
    }),

  reject: adminProcedure
    .input(z.object({ id: z.string(), adminNote: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const p = await prisma.payout.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!p) throw new TRPCError({ code: "NOT_FOUND" })
      if (p.status !== PayoutStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending payouts can be rejected.",
        })
      }
      return prisma.payout.update({
        where: { id: input.id },
        data: {
          status: PayoutStatus.rejected,
          decidedAt: new Date(),
          decidedById: ctx.user.id,
          adminNote: input.adminNote?.trim() || null,
        },
      })
    }),
})
