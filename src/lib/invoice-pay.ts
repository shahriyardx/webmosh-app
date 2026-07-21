import { prisma } from "@/lib/prisma"
import {
  PaymentStatus,
  WalletTxStatus,
  WalletTxType,
} from "@/generated/prisma/enums"

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export type InvoicePayState = {
  amount: number
  paid: number
  pending: number
  remaining: number
  /** Max a new payment can be right now (remaining minus already-pending). */
  payableNow: number
  /** True when nothing has been paid or submitted yet. */
  isFirst: boolean
  /** Minimum a new payment must be (50% of total on the first payment). */
  minPayment: number
}

/**
 * Compute the payment progress for an invoice: how much is paid, how much is
 * pending admin verification, and the min/max a new payment can be.
 *
 * Rule: the first payment must be at least 50% of the total; after that any
 * amount up to the remaining balance is allowed (unlimited installments).
 */
export async function getPayState(invoice: {
  id: string
  amount: number
  amountPaid: number
}): Promise<InvoicePayState> {
  const pendingAgg = await prisma.walletTransaction.aggregate({
    where: {
      invoiceId: invoice.id,
      type: WalletTxType.external_payment,
      status: WalletTxStatus.pending,
    },
    _sum: { amount: true },
  })
  const pending = round2(pendingAgg._sum.amount ?? 0)
  const paid = round2(invoice.amountPaid)
  const remaining = round2(invoice.amount - paid)
  const payableNow = Math.max(0, round2(remaining - pending))
  const isFirst = paid <= 0 && pending <= 0
  const minPayment = isFirst
    ? Math.min(round2(invoice.amount * 0.5), payableNow)
    : Math.min(0.01, payableNow)
  return {
    amount: invoice.amount,
    paid,
    pending,
    remaining,
    payableNow,
    isFirst,
    minPayment,
  }
}

/** Returns an error message if the amount isn't a valid payment, else null. */
export function validatePayment(
  amount: number,
  state: InvoicePayState,
): string | null {
  if (!amount || amount <= 0) return "Enter a valid amount."
  if (amount > state.payableNow + 0.001) {
    return `Amount exceeds what's left to pay ($${state.payableNow.toFixed(2)}).`
  }
  if (state.isFirst && amount < state.minPayment - 0.001) {
    return `The first payment must be at least $${state.minPayment.toFixed(2)} (50% of the total).`
  }
  return null
}

/**
 * Pure: given the invoice total and current paid amount, compute the new paid
 * amount + status after crediting `addAmount`.
 */
export function nextInvoiceState(
  amount: number,
  amountPaid: number,
  addAmount: number,
) {
  const newPaid = round2(amountPaid + addAmount)
  const fullyPaid = newPaid >= amount - 0.001
  return {
    amountPaid: newPaid,
    status: fullyPaid ? PaymentStatus.paid : PaymentStatus.partially_paid,
    fullyPaid,
  }
}
