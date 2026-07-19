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
      if (tx.status !== WalletTxStatus.pending || tx.type === WalletTxType.invoice_payment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be cancelled.",
        })
      }
      await prisma.walletTransaction.delete({ where: { id: input.id } })
      return { ok: true }
    }),

  /** Pay an unpaid invoice instantly from the wallet balance. */
  payInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." })
      }
      await assertOrgMember(ctx.user.id, invoice.organizationId)
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invoice is not in unpaid status.",
        })
      }
      const balance = await computeWalletBalance(ctx.user.id)
      if (invoice.amount > balance.available) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient wallet balance ($${balance.available.toFixed(2)} available, $${invoice.amount.toFixed(2)} needed).`,
        })
      }

      const [tx, updated] = await prisma.$transaction(async (db) => {
        const tx = await db.walletTransaction.create({
          data: {
            userId: ctx.user.id,
            type: WalletTxType.invoice_payment,
            status: WalletTxStatus.approved,
            amount: invoice.amount,
            method: "wallet",
            invoiceId: invoice.id,
            decidedAt: new Date(),
          },
        })
        const updated = await db.invoice.update({
          where: { id: invoice.id },
          data: {
            status: PaymentStatus.paid,
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
      await emailAdminInvoicePaid(org?.name ?? "a company", invoice.amount).catch(() => {})
      await emailUserPayment(invoice.organizationId, true, invoice.amount).catch(() => {})
      await createAdminNotification({
        kind: "invoice.paid",
        title: `Invoice paid from wallet: $${invoice.amount.toFixed(2)}`,
        body: `${ctx.user.name ?? ctx.user.email} paid an invoice for ${org?.name ?? "a company"} with their wallet balance.`,
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
        })
        .optional(),
    )
    .query(({ input }) =>
      prisma.walletTransaction.findMany({
        where: {
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.type ? { type: input.type } : {}),
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

  approve: adminProcedure
    .input(z.object({ id: z.string(), adminNote: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const tx = await prisma.walletTransaction.findUnique({
        where: { id: input.id },
        select: { status: true, type: true, userId: true, amount: true },
      })
      if (!tx) throw new TRPCError({ code: "NOT_FOUND" })
      if (tx.status !== WalletTxStatus.pending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending transactions can be approved.",
        })
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
