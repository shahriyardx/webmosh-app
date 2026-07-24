import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { ExchangeTxStatus } from "@/generated/prisma/enums"
import { createAdminNotification } from "@/lib/notifications"

const filterShape = {
  fromDate: z.date().optional(),
  toDate: z.date().optional(),
  fromAccount: z.string().optional(),
  toAccount: z.string().optional(),
}

const txShape = {
  date: z.date(),
  amount: z.number().positive(),
  rate: z.number().positive(),
  fromAccount: z.string().min(1, "From account is required"),
  toAccount: z.string().min(1, "To account is required"),
  remark: z.string().optional(),
}

type Filters = {
  fromDate?: Date
  toDate?: Date
  fromAccount?: string
  toAccount?: string
}

function buildWhere(userId: string, f?: Filters) {
  return {
    userId,
    ...(f?.fromDate || f?.toDate
      ? {
          date: {
            ...(f?.fromDate ? { gte: f.fromDate } : {}),
            ...(f?.toDate ? { lte: f.toDate } : {}),
          },
        }
      : {}),
    ...(f?.fromAccount ? { fromAccount: f.fromAccount } : {}),
    ...(f?.toAccount ? { toAccount: f.toAccount } : {}),
  }
}

async function listFor(userId: string, f?: Filters) {
  const items = await prisma.exchangeTransaction.findMany({
    where: buildWhere(userId, f),
    orderBy: { date: "desc" },
  })
  const approved = items.filter((i) => i.status === ExchangeTxStatus.approved)
  const totalAmount = approved.reduce((s, i) => s + i.amount, 0)
  const totalBdt = approved.reduce((s, i) => s + i.amount * i.rate, 0)
  const pendingCount = items.length - approved.length
  return { items, totalAmount, totalBdt, count: items.length, pendingCount }
}

async function accountsFor(userId: string) {
  const rows = await prisma.exchangeTransaction.findMany({
    where: { userId },
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
}

async function assertEnabled(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { exchangeEnabled: true },
  })
  if (!u?.exchangeEnabled) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The exchange feature is not enabled for your account.",
    })
  }
}

const cleanTx = (input: z.infer<z.ZodObject<typeof txShape>>) => ({
  date: input.date,
  amount: input.amount,
  rate: input.rate,
  fromAccount: input.fromAccount.trim(),
  toAccount: input.toAccount.trim(),
  remark: input.remark?.trim() || null,
})

export const exchangeRouter = router({
  // ---------------------------- ADMIN ----------------------------

  /** Clients who have the exchange feature enabled, with activity counts. */
  enabledClients: adminProcedure.query(async () => {
    const users = await prisma.user.findMany({
      where: { exchangeEnabled: true },
      select: { id: true, name: true, email: true, image: true },
    })
    if (!users.length) return []
    const [pending, total] = await Promise.all([
      prisma.exchangeTransaction.groupBy({
        by: ["userId"],
        where: { status: ExchangeTxStatus.pending },
        _count: { _all: true },
      }),
      prisma.exchangeTransaction.groupBy({
        by: ["userId"],
        _count: { _all: true },
      }),
    ])
    const pMap = new Map(pending.map((g) => [g.userId, g._count._all]))
    const tMap = new Map(total.map((g) => [g.userId, g._count._all]))
    return users
      .map((u) => ({
        ...u,
        pendingCount: pMap.get(u.id) ?? 0,
        txCount: tMap.get(u.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }),

  /** All clients (for the grant-access picker). */
  allClients: adminProcedure.query(() =>
    prisma.user.findMany({
      where: { OR: [{ role: "user" }, { role: null }] },
      select: { id: true, name: true, email: true, exchangeEnabled: true },
      orderBy: { name: "asc" },
    }),
  ),

  setEnabled: adminProcedure
    .input(z.object({ userId: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) =>
      prisma.user.update({
        where: { id: input.userId },
        data: { exchangeEnabled: input.enabled },
        select: { id: true, exchangeEnabled: true },
      }),
    ),

  clientInfo: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const u = await prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          exchangeEnabled: true,
        },
      })
      if (!u) throw new TRPCError({ code: "NOT_FOUND" })
      return u
    }),

  list: adminProcedure
    .input(z.object({ userId: z.string(), ...filterShape }))
    .query(({ input }) => listFor(input.userId, input)),

  accounts: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => accountsFor(input.userId)),

  create: adminProcedure
    .input(z.object({ userId: z.string(), ...txShape }))
    .mutation(({ input }) =>
      prisma.exchangeTransaction.create({
        data: {
          userId: input.userId,
          status: ExchangeTxStatus.approved,
          ...cleanTx(input),
        },
      }),
    ),

  update: adminProcedure
    .input(z.object({ id: z.string(), ...txShape }))
    .mutation(({ input }) =>
      prisma.exchangeTransaction.update({
        where: { id: input.id },
        data: cleanTx(input),
      }),
    ),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      prisma.exchangeTransaction.update({
        where: { id: input.id },
        data: { status: ExchangeTxStatus.approved },
      }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.exchangeTransaction.delete({ where: { id: input.id } })
      return { ok: true }
    }),

  // ---------------------------- CLIENT ----------------------------

  myAccess: protectedProcedure.query(async ({ ctx }) => {
    const u = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { exchangeEnabled: true },
    })
    return { enabled: !!u?.exchangeEnabled }
  }),

  myList: protectedProcedure
    .input(z.object(filterShape).optional())
    .query(async ({ input, ctx }) => {
      await assertEnabled(ctx.user.id)
      return listFor(ctx.user.id, input)
    }),

  myAccounts: protectedProcedure.query(async ({ ctx }) => {
    await assertEnabled(ctx.user.id)
    return accountsFor(ctx.user.id)
  }),

  /** Client submits a transaction — created as pending until an admin approves. */
  myCreate: protectedProcedure
    .input(z.object(txShape))
    .mutation(async ({ input, ctx }) => {
      await assertEnabled(ctx.user.id)
      const tx = await prisma.exchangeTransaction.create({
        data: {
          userId: ctx.user.id,
          status: ExchangeTxStatus.pending,
          ...cleanTx(input),
        },
      })
      await createAdminNotification({
        kind: "exchange.submitted",
        title: `Exchange entry pending: $${input.amount.toFixed(2)}`,
        body: `${ctx.user.name ?? ctx.user.email} submitted an exchange transaction for approval.`,
        link: `/admin/exchange/${ctx.user.id}`,
      })
      return tx
    }),

  /** Client removes one of their own still-pending entries. */
  myDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tx = await prisma.exchangeTransaction.findUnique({
        where: { id: input.id },
        select: { userId: true, status: true },
      })
      if (!tx || tx.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (tx.status !== ExchangeTxStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending entries can be removed.",
        })
      }
      await prisma.exchangeTransaction.delete({ where: { id: input.id } })
      return { ok: true }
    }),
})
