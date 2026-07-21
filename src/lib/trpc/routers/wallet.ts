import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  adminProcedure,
  assertOrgMember,
  protectedProcedure,
  router,
} from "../server"
import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/notifications"
import { saveBankAccountForUser } from "./bank-accounts"
import { emailAdminInvoicePaid, emailUserPayment } from "@/lib/notify"
import {
  getPayState,
  nextInvoiceState,
  round2,
  validatePayment,
} from "@/lib/invoice-pay"
import {
  PaymentStatus,
  WalletTxStatus,
  WalletTxType,
} from "@/generated/prisma/enums"

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
 * Wallet balance for a user:
 *  approved top-ups
 *  minus approved payouts and invoice payments (money gone)
 *  minus pending payouts (locked while under review)
 * Pending top-ups don't count until the admin verifies them.
 */
async function computeWalletBalance(userId: string) {
  const grouped = await prisma.walletTransaction.groupBy({
    by: ["type", "status"],
    where: { userId },
    _sum: { amount: true },
  })
  const sum = (type: WalletTxType, status: WalletTxStatus) =>
    grouped.find((g) => g.type === type && g.status === status)?._sum.amount ?? 0

  const added = sum(WalletTxType.topup, WalletTxStatus.approved)
  const pendingTopup = sum(WalletTxType.topup, WalletTxStatus.pending)
  const paidOut = sum(WalletTxType.payout, WalletTxStatus.approved)
  const lockedPayout = sum(WalletTxType.payout, WalletTxStatus.pending)
  const spent = sum(WalletTxType.invoice_payment, WalletTxStatus.approved)

  const available = Math.max(0, added - paidOut - lockedPayout - spent)
  return { available, added, pendingTopup, paidOut, lockedPayout, spent }
}

type BalanceGroup = {
  type: WalletTxType
  status: WalletTxStatus
  _sum: { amount: number | null }
}

/** Same math as computeWalletBalance, but from pre-grouped rows for one user. */
function balanceFromGroups(rows: BalanceGroup[]) {
  const sum = (type: WalletTxType, status: WalletTxStatus) =>
    rows.find((r) => r.type === type && r.status === status)?._sum.amount ?? 0
  const added = sum(WalletTxType.topup, WalletTxStatus.approved)
  const pendingTopup = sum(WalletTxType.topup, WalletTxStatus.pending)
  const paidOut = sum(WalletTxType.payout, WalletTxStatus.approved)
  const lockedPayout = sum(WalletTxType.payout, WalletTxStatus.pending)
  const spent = sum(WalletTxType.invoice_payment, WalletTxStatus.approved)
  const available = Math.max(0, added - paidOut - lockedPayout - spent)
  return { available, added, pendingTopup, paidOut, lockedPayout, spent }
}

export const walletRouter = router({
  myBalance: protectedProcedure.query(({ ctx }) =>
    computeWalletBalance(ctx.user.id),
  ),

  myTransactions: protectedProcedure.query(({ ctx }) =>
    prisma.walletTransaction.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        method: true,
        transactionId: true,
        note: true,
        adminNote: true,
        decidedAt: true,
        createdAt: true,
        invoice: {
          select: { id: true, number: true, amount: true, organizationId: true },
        },
      },
    }),
  ),

  /** Submit a top-up: user already paid via QR/bKash and pastes the trx ID. */
  topup: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        method: z.enum(["bkash", "BanglaQR"]),
        transactionId: z.string().min(1, "Transaction ID is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const tx = await prisma.walletTransaction.create({
        data: {
          userId: ctx.user.id,
          type: WalletTxType.topup,
          amount: input.amount,
          method: input.method,
          transactionId: input.transactionId.trim(),
        },
      })
      await createAdminNotification({
        kind: "wallet.topup_submitted",
        title: `Wallet top-up: $${input.amount.toFixed(2)}`,
        body: `${ctx.user.name ?? ctx.user.email} submitted a ${input.method} payment. Please verify.`,
        link: "/admin/wallet",
      })
      return tx
    }),

  requestPayout: protectedProcedure
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
      const balance = await computeWalletBalance(ctx.user.id)
      if (input.amount > balance.available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Requested amount exceeds your available balance ($${balance.available.toFixed(2)}).`,
        })
      }
      if (input.saveBankAccount) {
        await saveBankAccountForUser(ctx.user.id, {
          method: input.method,
          ...input.bankDetails,
        })
      }
      const tx = await prisma.walletTransaction.create({
        data: {
          userId: ctx.user.id,
          type: WalletTxType.payout,
          amount: input.amount,
          method: input.method,
          bankDetails: input.bankDetails,
          note: input.note?.trim() || null,
        },
      })
      await createAdminNotification({
        kind: "wallet.payout_requested",
        title: `Client payout request: $${input.amount.toFixed(2)}`,
        body: `${ctx.user.name ?? ctx.user.email} requested a ${input.method} payout from their wallet.`,
        link: "/admin/wallet",
      })
      return tx
    }),

  /** Cancel own pending top-up or payout request. */
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tx = await prisma.walletTransaction.findUnique({
        where: { id: input.id },
        select: { userId: true, status: true, type: true },
      })
      if (!tx || tx.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (
        tx.status !== WalletTxStatus.pending ||
        (tx.type !== WalletTxType.topup && tx.type !== WalletTxType.payout)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending top-ups and payout requests can be cancelled.",
        })
      }
      await prisma.walletTransaction.delete({ where: { id: input.id } })
      return { ok: true }
    }),

  /**
   * Pay an invoice from wallet balance — full or partial. The first payment
   * must be at least 50% of the total; afterwards any amount up to the
   * remaining balance is allowed. Credited instantly.
   */
  payInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." })
      }
      await assertOrgMember(ctx.user.id, invoice.organizationId)
      if (invoice.status === PaymentStatus.paid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invoice is already fully paid.",
        })
      }

      const state = await getPayState(invoice)
      const amount = round2(input.amount ?? state.payableNow)
      const err = validatePayment(amount, state)
      if (err) throw new TRPCError({ code: "BAD_REQUEST", message: err })

      const balance = await computeWalletBalance(ctx.user.id)
      if (amount > balance.available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient wallet balance ($${balance.available.toFixed(2)} available, $${amount.toFixed(2)} needed).`,
        })
      }

      const next = nextInvoiceState(invoice.amount, invoice.amountPaid, amount)

      const [tx, updated] = await prisma.$transaction(async (db) => {
        const tx = await db.walletTransaction.create({
          data: {
            userId: ctx.user.id,
            type: WalletTxType.invoice_payment,
            status: WalletTxStatus.approved,
            amount,
            method: "wallet",
            invoiceId: invoice.id,
            decidedAt: new Date(),
          },
        })
        const updated = await db.invoice.update({
          where: { id: invoice.id },
          data: {
            status: next.status,
            amountPaid: next.amountPaid,
            paymentMethod: "wallet",
            transactionId: tx.id,
            rejectReason: null,
          },
        })
        return [tx, updated]
      })

      const org = await prisma.organization.findUnique({
        where: { id: invoice.organizationId },
        select: { name: true },
      })
      if (next.fullyPaid) {
        await emailAdminInvoicePaid(org?.name ?? "a company", invoice.amount).catch(() => {})
        await emailUserPayment(invoice.organizationId, true, invoice.amount).catch(() => {})
      }
      await createAdminNotification({
        kind: "invoice.paid",
        title: next.fullyPaid
          ? `Invoice paid from wallet: $${amount.toFixed(2)}`
          : `Partial wallet payment: $${amount.toFixed(2)}`,
        body: `${ctx.user.name ?? ctx.user.email} paid $${amount.toFixed(2)} toward an invoice for ${org?.name ?? "a company"} from their wallet${next.fullyPaid ? "" : ` ($${round2(invoice.amount - next.amountPaid).toFixed(2)} remaining)`}.`,
        link: "/admin/invoices",
      })

      return { transaction: tx, invoice: updated }
    }),

  // ---------- ADMIN ----------

  listAll: adminProcedure
    .input(
      z
        .object({
          status: z.nativeEnum(WalletTxStatus).optional(),
          type: z.nativeEnum(WalletTxType).optional(),
          userId: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) =>
      prisma.walletTransaction.findMany({
        where: {
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.type ? { type: input.type } : {}),
          ...(input?.userId ? { userId: input.userId } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          method: true,
          transactionId: true,
          bankDetails: true,
          note: true,
          adminNote: true,
          decidedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          invoice: { select: { id: true, number: true, amount: true } },
        },
      }),
    ),

  /**
   * Count of wallet transactions awaiting admin action (pending top-ups to
   * verify + pending payout requests). Drives the sidebar badge.
   */
  pendingCount: adminProcedure.query(() =>
    prisma.walletTransaction.count({
      where: { status: WalletTxStatus.pending },
    }),
  ),

  /**
   * Per-client wallet balances. Lists every client (role "user"), including
   * those with no wallet activity yet (balance 0), so admins can top up any
   * client. Includes lifetime totals and activity metadata.
   */
  clientBalances: adminProcedure.query(async () => {
    const [clients, byType, meta] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ role: "user" }, { role: null }] },
        select: { id: true, name: true, email: true, image: true },
      }),
      prisma.walletTransaction.groupBy({
        by: ["userId", "type", "status"],
        _sum: { amount: true },
      }),
      prisma.walletTransaction.groupBy({
        by: ["userId"],
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ])

    const metaMap = new Map(meta.map((m) => [m.userId, m]))

    return clients
      .map((u) => {
        const rows = byType.filter((g) => g.userId === u.id)
        const m = metaMap.get(u.id)
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          ...balanceFromGroups(rows),
          txCount: m?._count._all ?? 0,
          lastActivity: m?._max.createdAt ?? null,
        }
      })
      .sort((a, b) => {
        if (b.available !== a.available) return b.available - a.available
        const at = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const bt = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        if (bt !== at) return bt - at
        return a.name.localeCompare(b.name)
      })
  }),

  /**
   * Manually add or remove a client's wallet balance. Recorded as an
   * immediately-approved top-up (add) or payout (remove) with method
   * "admin" so it flows through the existing balance math and shows up in
   * the client's own transaction history for transparency.
   */
  adjustBalance: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        direction: z.enum(["add", "remove"]),
        amount: z.number().positive(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." })

      if (input.direction === "remove") {
        const balance = await computeWalletBalance(input.userId)
        if (input.amount > balance.available) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Can't remove more than the client's available balance ($${balance.available.toFixed(2)}).`,
          })
        }
      }

      return prisma.walletTransaction.create({
        data: {
          userId: input.userId,
          type:
            input.direction === "add"
              ? WalletTxType.topup
              : WalletTxType.payout,
          status: WalletTxStatus.approved,
          amount: input.amount,
          method: "admin",
          note: input.note?.trim() || null,
          adminNote: input.note?.trim() || "Manual balance adjustment",
          decidedAt: new Date(),
          decidedById: ctx.user.id,
        },
      })
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string(), adminNote: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const tx = await prisma.walletTransaction.findUnique({
        where: { id: input.id },
        select: {
          status: true,
          type: true,
          userId: true,
          amount: true,
          invoiceId: true,
        },
      })
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" })
      if (tx.status !== WalletTxStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending transactions can be approved.",
        })
      }

      // External (Bangla QR/bKash) invoice payment: credit the invoice on approval.
      if (tx.type === WalletTxType.external_payment && tx.invoiceId) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: tx.invoiceId },
        })
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND" })
        const next = nextInvoiceState(
          invoice.amount,
          invoice.amountPaid,
          tx.amount,
        )
        const [updatedTx] = await prisma.$transaction([
          prisma.walletTransaction.update({
            where: { id: input.id },
            data: {
              status: WalletTxStatus.approved,
              decidedAt: new Date(),
              decidedById: ctx.user.id,
              adminNote: input.adminNote?.trim() || null,
            },
          }),
          prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: next.amountPaid,
              status: next.status,
              rejectReason: null,
            },
          }),
        ])
        if (next.fullyPaid) {
          const org = await prisma.organization.findUnique({
            where: { id: invoice.organizationId },
            select: { name: true },
          })
          await emailAdminInvoicePaid(org?.name ?? "a company", invoice.amount).catch(() => {})
          await emailUserPayment(invoice.organizationId, true, invoice.amount).catch(() => {})
        }
        return updatedTx
      }

      return prisma.walletTransaction.update({
        where: { id: input.id },
        data: {
          status: WalletTxStatus.approved,
          decidedAt: new Date(),
          decidedById: ctx.user.id,
          adminNote: input.adminNote?.trim() || null,
        },
      })
    }),

  reject: adminProcedure
    .input(z.object({ id: z.string(), adminNote: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const tx = await prisma.walletTransaction.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" })
      if (tx.status !== WalletTxStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending transactions can be rejected.",
        })
      }
      return prisma.walletTransaction.update({
        where: { id: input.id },
        data: {
          status: WalletTxStatus.rejected,
          decidedAt: new Date(),
          decidedById: ctx.user.id,
          adminNote: input.adminNote?.trim() || null,
        },
      })
    }),
})
