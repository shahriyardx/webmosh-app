"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WalletIcon, CheckCircle2Icon, ClockIcon } from "lucide-react"

const QR_CONTENT =
  "00020101021126540013com.pathaopay01020302041008031991008200186593649045204739953030505802BD5907WEBMOSH60045460625002110186593649003085594973007082f9893880807PAYMENT63049E3F"

function money(n: number) {
  return `$${n.toFixed(2)}`
}

/**
 * Payment panel for an unpaid / partially-paid invoice. Supports partial
 * payments (first payment ≥50% of the total, then any amount) via wallet
 * balance or Bangla QR. Every payment is recorded as a wallet transaction.
 */
export function InvoicePayPanel({
  invoiceId,
  bdtRate,
  onChanged,
}: {
  invoiceId: string
  bdtRate: number | null
  onChanged: () => void
}) {
  const utils = trpc.useUtils()
  const { data: state } = trpc.invoices.paymentState.useQuery({ invoiceId })
  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()

  const [amount, setAmount] = useState("")
  const [transactionId, setTransactionId] = useState("")

  // Default the amount to the full remaining balance once state loads.
  useEffect(() => {
    if (state && amount === "" && state.payableNow > 0) {
      setAmount(state.payableNow.toFixed(2))
    }
  }, [state, amount])

  const refresh = () => {
    utils.invoices.paymentState.invalidate({ invoiceId })
    utils.wallet.myBalance.invalidate()
    utils.wallet.myTransactions.invalidate()
    onChanged()
  }

  const payWallet = trpc.wallet.payInvoice.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.invoice.status === "paid"
          ? "Invoice paid in full"
          : "Partial payment applied",
      )
      setAmount("")
      refresh()
    },
    onError: (e) => toast.error(e.message),
  })

  const submitQr = trpc.invoices.submitTransaction.useMutation({
    onSuccess: () => {
      toast.success("Payment submitted — awaiting verification")
      setAmount("")
      setTransactionId("")
      refresh()
    },
    onError: (e) => toast.error(e.message),
  })

  if (!state) return null

  const { amount: total, paid, pending, remaining, payableNow, isFirst, minPayment } =
    state
  const available = walletBalance?.available ?? 0
  const amt = parseFloat(amount) || 0
  const bdt = bdtRate ? (amt * bdtRate).toFixed(2) : null

  const amountError =
    amt <= 0
      ? null
      : amt > payableNow + 0.001
        ? `Max ${money(payableNow)}`
        : isFirst && amt < minPayment - 0.001
          ? `Min ${money(minPayment)} (50%)`
          : null
  const amountValid = amt > 0 && !amountError

  const progressPct = total > 0 ? Math.min(100, (paid / total) * 100) : 0

  // Fully covered (paid + pending == total): nothing more to submit.
  if (payableNow <= 0) {
    return (
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3.5">
          <span className="text-sm font-semibold">Payment</span>
        </div>
        <div className="space-y-3 px-5 py-4">
          <PaidProgress paid={paid} total={total} pct={progressPct} />
          {pending > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
              <ClockIcon className="size-4 shrink-0" />
              {money(pending)} awaiting verification. We&apos;ll confirm it
              shortly.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="border-b border-border px-5 py-3.5">
        <span className="text-sm font-semibold">Make a payment</span>
      </div>

      <div className="space-y-5 px-5 py-4">
        {paid > 0 && <PaidProgress paid={paid} total={total} pct={progressPct} />}

        {pending > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            <ClockIcon className="size-3.5 shrink-0" />
            {money(pending)} awaiting verification
          </div>
        )}

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="pay-amount">Amount to pay (USD)</Label>
            <span className="text-xs text-muted-foreground">
              {money(remaining)} remaining
              {isFirst && (
                <> · min {money(minPayment)}</>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {payableNow > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(payableNow.toFixed(2))}
              >
                Full
              </Button>
            )}
          </div>
          {amountError && (
            <p className="text-xs text-red-500">{amountError}</p>
          )}
          {isFirst && !amountError && (
            <p className="text-xs text-muted-foreground">
              The first payment must be at least 50% of the total.
            </p>
          )}
        </div>

        {/* Pay with wallet */}
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
                <WalletIcon className="size-4 text-sky-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Pay from wallet balance</p>
                <p className="text-xs text-muted-foreground">
                  Available: {money(available)}
                </p>
              </div>
            </div>
            {amountValid && amt > available ? (
              <Button variant="outline" asChild>
                <Link href="/account/wallet">Add money</Link>
              </Button>
            ) : (
              <Button
                disabled={!amountValid || amt > available || payWallet.isPending}
                onClick={() => payWallet.mutate({ invoiceId, amount: amt })}
              >
                {payWallet.isPending ? "Paying…" : `Pay ${money(amt)}`}
              </Button>
            )}
          </div>
        </div>

        {/* Pay with Bangla QR */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              or pay with Bangla QR
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={QR_CONTENT} size={200} level="M" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Scan with any Bangla QR app (bKash, Nagad, Rocket, bank app) and
              pay{" "}
              {bdt ? <strong>৳{bdt}</strong> : <strong>{money(amt)}</strong>}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-txid">Transaction ID (TrxID)</Label>
            <Input
              id="pay-txid"
              placeholder="Paste the transaction ID after paying"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!amountValid || !transactionId || submitQr.isPending}
            onClick={() =>
              submitQr.mutate({
                invoiceId,
                paymentMethod: "BanglaQR",
                transactionId,
                amount: amt,
              })
            }
          >
            {submitQr.isPending ? "Submitting…" : `Submit payment of ${money(amt)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PaidProgress({
  paid,
  total,
  pct,
}: {
  paid: number
  total: number
  pct: number
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4" />
          {money(paid)} paid
        </span>
        <span className="text-muted-foreground">of {money(total)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
