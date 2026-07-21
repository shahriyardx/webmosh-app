import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  adminProcedure,
  freelancerProcedure,
  router,
} from "../server"
import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/notifications"
import { saveBankAccountForUser } from "./bank-accounts"
import { PayoutStatus, TaskStatus } from "@/generated/prisma/enums"

const bankDetailsSchema = z.object({
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  bankName: z.string().optional(),
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
  const [earnedAgg, approvedAgg, pendingAgg, adjAgg] = await Promise.all([
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
    prisma.freelancerAdjustment.aggregate({
      where: { freelancerId },
      _sum: { amount: true },
    }),
  ])
  const earned = earnedAgg._sum.payoutAmount ?? 0
  const paidOut = approvedAgg._sum.amount ?? 0
  const requested = pendingAgg._sum.amount ?? 0
  const adjustments = adjAgg._sum.amount ?? 0
  const available = Math.max(0, earned + adjustments - paidOut - requested)
  return { earned, paidOut, requested, adjustments, available }
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
        saveBankAccount: z.boolean().optional(),
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
      if (input.saveBankAccount) {
        await saveBankAccountForUser(ctx.user.id, {
          method: input.method,
          ...input.bankDetails,
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

  // ---------- ADMIN: per-freelancer balance management ----------

  /** Balance breakdown for a specific freelancer (admin view). */
  adminBalance: adminProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(({ input }) => computeBalance(input.freelancerId)),

  /** Full payout history for a freelancer (admin view). */
  adminList: adminProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(({ input }) =>
      prisma.payout.findMany({
        where: { freelancerId: input.freelancerId },
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

  /**
   * Unified transaction history for a freelancer: task payments (earnings on
   * approved tasks), manual adjustments (add/remove) and payouts — sorted
   * newest first. Amount is signed (+ credit, − debit).
   */
  adminTransactions: adminProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(async ({ input }) => {
      const { freelancerId } = input
      const [doneTasks, adjustments, payouts] = await Promise.all([
        prisma.task.findMany({
          where: {
            assignedToId: freelancerId,
            status: TaskStatus.done,
            payoutAmount: { not: null },
          },
          select: { id: true, title: true, payoutAmount: true, updatedAt: true },
        }),
        prisma.freelancerAdjustment.findMany({
          where: { freelancerId },
          select: { id: true, amount: true, note: true, createdAt: true },
        }),
        prisma.payout.findMany({
          where: {
            freelancerId,
            status: {
              in: [PayoutStatus.approved, PayoutStatus.pending],
            },
          },
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            createdAt: true,
          },
        }),
      ])

      const items = [
        ...doneTasks.map((t) => ({
          id: `task-${t.id}`,
          kind: "task" as const,
          label: `Task payment — ${t.title}`,
          amount: t.payoutAmount ?? 0,
          status: null as string | null,
          date: t.updatedAt,
        })),
        ...adjustments.map((a) => ({
          id: `adj-${a.id}`,
          kind: "adjustment" as const,
          label:
            a.note ||
            (a.amount >= 0 ? "Balance added by admin" : "Balance removed by admin"),
          amount: a.amount,
          status: null as string | null,
          date: a.createdAt,
        })),
        ...payouts.map((p) => ({
          id: `payout-${p.id}`,
          kind: "payout" as const,
          label: `Payout — ${p.method}`,
          amount: -p.amount,
          status: p.status as string | null,
          date: p.createdAt,
        })),
      ]

      items.sort((a, b) => b.date.getTime() - a.date.getTime())
      return items
    }),

  /**
   * Manually credit or deduct a freelancer's balance. Recorded as a signed
   * adjustment (positive = add, negative = remove). Deductions can't exceed
   * the current available balance.
   */
  adjustBalance: adminProcedure
    .input(
      z.object({
        freelancerId: z.string(),
        direction: z.enum(["add", "remove"]),
        amount: z.number().positive(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const freelancer = await prisma.user.findFirst({
        where: { id: input.freelancerId, role: "freelancer" },
        select: { id: true },
      })
      if (!freelancer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Freelancer not found.",
        })
      }
      if (input.direction === "remove") {
        const balance = await computeBalance(input.freelancerId)
        if (input.amount > balance.available) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Can't remove more than the available balance ($${balance.available.toFixed(2)}).`,
          })
        }
      }
      return prisma.freelancerAdjustment.create({
        data: {
          freelancerId: input.freelancerId,
          amount:
            input.direction === "add" ? input.amount : -Math.abs(input.amount),
          note: input.note?.trim() || null,
          createdById: ctx.user.id,
        },
      })
    }),

  /**
   * Reset a freelancer's payout history — deletes all their payout records.
   * Earnings and manual adjustments are untouched, so the available balance
   * returns to (earned + adjustments).
   */
  resetHistory: adminProcedure
    .input(z.object({ freelancerId: z.string() }))
    .mutation(async ({ input }) => {
      const res = await prisma.payout.deleteMany({
        where: { freelancerId: input.freelancerId },
      })
      return { deleted: res.count }
    }),
})
