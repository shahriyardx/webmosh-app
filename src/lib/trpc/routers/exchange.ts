import { z } from "zod"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

export const exchangeRouter = router({
  /** Filtered list of exchange transactions plus totals for the filtered set. */
  list: adminProcedure
    .input(
      z
        .object({
          fromDate: z.date().optional(),
          toDate: z.date().optional(),
          fromAccount: z.string().optional(),
          toAccount: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const dateFilter =
        input?.fromDate || input?.toDate
          ? {
              date: {
                ...(input?.fromDate ? { gte: input.fromDate } : {}),
                ...(input?.toDate ? { lte: input.toDate } : {}),
              },
            }
          : {}

      const items = await prisma.exchangeTransaction.findMany({
        where: {
          ...dateFilter,
          ...(input?.fromAccount ? { fromAccount: input.fromAccount } : {}),
          ...(input?.toAccount ? { toAccount: input.toAccount } : {}),
        },
        orderBy: { date: "desc" },
      })

      const totalAmount = items.reduce((s, i) => s + i.amount, 0)
      const totalBdt = items.reduce((s, i) => s + i.amount * i.rate, 0)
      return { items, totalAmount, totalBdt, count: items.length }
    }),

  /** Distinct accounts, rates + remarks for filter dropdowns and autocomplete. */
  accounts: adminProcedure.query(async () => {
    const rows = await prisma.exchangeTransaction.findMany({
      select: { fromAccount: true, toAccount: true, rate: true, remark: true },
      orderBy: { createdAt: "desc" },
    })
    const from = [...new Set(rows.map((r) => r.fromAccount))].sort()
    const to = [...new Set(rows.map((r) => r.toAccount))].sort()
    const rates = [...new Set(rows.map((r) => String(r.rate)))]
    const remarks = [
      ...new Set(
        rows.map((r) => r.remark?.trim()).filter((r): r is string => !!r),
      ),
    ]
    return { from, to, rates, remarks }
  }),

  create: adminProcedure
    .input(
      z.object({
        date: z.date(),
        amount: z.number().positive(),
        rate: z.number().positive(),
        fromAccount: z.string().min(1, "From account is required"),
        toAccount: z.string().min(1, "To account is required"),
        remark: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      prisma.exchangeTransaction.create({
        data: {
          date: input.date,
          amount: input.amount,
          rate: input.rate,
          fromAccount: input.fromAccount.trim(),
          toAccount: input.toAccount.trim(),
          remark: input.remark?.trim() || null,
        },
      }),
    ),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        date: z.date(),
        amount: z.number().positive(),
        rate: z.number().positive(),
        fromAccount: z.string().min(1, "From account is required"),
        toAccount: z.string().min(1, "To account is required"),
        remark: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      prisma.exchangeTransaction.update({
        where: { id: input.id },
        data: {
          date: input.date,
          amount: input.amount,
          rate: input.rate,
          fromAccount: input.fromAccount.trim(),
          toAccount: input.toAccount.trim(),
          remark: input.remark?.trim() || null,
        },
      }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.exchangeTransaction.delete({ where: { id: input.id } })
      return { ok: true }
    }),
})

