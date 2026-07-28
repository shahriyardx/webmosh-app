"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import {
  ReceiptIcon,
  ArrowRightIcon,
  WalletIcon,
  Loader2Icon,
  CheckIcon,
  XIcon,
} from "lucide-react"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const QR_CONTENT =
  "00020101021126540013com.pathaopay01020302041008031991008200186593649045204739953030505802BD5907WEBMOSH60045460625002110186593649003085594973007082f9893880807PAYMENT63049E3F"

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  unpaid: {
    label: "Unpaid",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  partially_paid: {
    label: "Partially paid",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  processing: {
    label: "Processing",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  paid: {
    label: "Paid",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  },
}

const money = (n: number) => `$${n.toFixed(2)}`

export default function AccountInvoicesPage() {
  const utils = trpc.useUtils()
  const { data: invoices, isLoading } = trpc.invoices.listForUser.useQuery()
  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<"wallet" | "qr" | null>(null)
  const [txnId, setTxnId] = useState("")

  const { data: settings } = trpc.settings.getAll.useQuery(undefined, {
    enabled: dialog === "qr",
  })
  const usdToBdt = settings?.usd_to_bdt_rate
    ? parseFloat(settings.usd_to_bdt_rate)
    : null

  const list = invoices ?? []
  const totalInvoiced = list.reduce((s, i) => s + i.amount, 0)
  const totalPaid = list.reduce(
    (s, i) => s + (i.status === "paid" ? i.amount : (i.amountPaid ?? 0)),
    0,
  )
  const outstanding = list
    .filter((i) => i.status === "unpaid" || i.status === "partially_paid")
    .reduce((s, i) => s + Math.max(0, i.amount - (i.amountPaid ?? 0)), 0)

  const remainingOf = (i: (typeof list)[number]) =>
    Math.max(0, i.amount - (i.amountPaid ?? 0))
  const isPayable = (i: (typeof list)[number]) =>
    (i.status === "unpaid" || i.status === "partially_paid") &&
    remainingOf(i) > 0

  const selectedTotal = useMemo(
    () =>
      list
        .filter((i) => selected.has(i.id))
        .reduce((s, i) => s + remainingOf(i), 0),
    [list, selected],
  )
  const bdtTotal = usdToBdt ? (selectedTotal * usdToBdt).toFixed(2) : null

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const clear = () => setSelected(new Set())

  const onDone = (msg: string) => {
    utils.invoices.listForUser.invalidate()
    utils.wallet.myBalance.invalidate()
    clear()
    setDialog(null)
    setTxnId("")
    toast.success(msg)
  }

  const payWallet = trpc.wallet.payInvoicesCombined.useMutation({
    onSuccess: (r) => onDone(`Paid ${r.count} invoice${r.count === 1 ? "" : "s"} from your wallet.`),
    onError: (e) => toast.error(e.message),
  })
  const submitQr = trpc.invoices.submitCombinedTransaction.useMutation({
    onSuccess: (r) =>
      onDone(
        `Submitted payment for ${r.count} invoice${r.count === 1 ? "" : "s"} — we'll verify shortly.`,
      ),
    onError: (e) => toast.error(e.message),
  })

  const invoiceIds = Array.from(selected)
  const walletAvail = walletBalance?.available ?? 0
  const enoughWallet = walletAvail >= selectedTotal - 0.001

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Select multiple invoices to pay them together.
          </p>
        </div>
        {outstanding > 0 && (
          <Link
            href="/account/wallet"
            className="group flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-2.5 transition-colors hover:bg-sky-500/10"
          >
            <WalletIcon className="size-4 text-sky-500" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">
                {money(outstanding)} outstanding
              </p>
              <p className="text-muted-foreground">
                Wallet: {money(walletAvail)} available
              </p>
            </div>
          </Link>
        )}
      </div>

      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          <Stat label="Total invoiced" value={money(totalInvoiced)} />
          <Stat
            label="Paid"
            value={money(totalPaid)}
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <Stat
            label="Outstanding"
            value={money(outstanding)}
            valueClass={
              outstanding > 0 ? "text-amber-600 dark:text-amber-400" : undefined
            }
          />
          <Stat label="Invoices" value={String(list.length)} />
        </div>
      )}

      {!list.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <ReceiptIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No invoices yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((inv) => {
            const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.unpaid
            const paid = inv.amountPaid ?? 0
            const remaining = Math.max(0, inv.amount - paid)
            const payable = isPayable(inv)
            const checked = selected.has(inv.id)
            const showBalance = payable
            const pct =
              inv.amount > 0 ? Math.min(100, (paid / inv.amount) * 100) : 0
            return (
              <div
                key={inv.id}
                className={`rounded-2xl border bg-card p-4 transition-all ${
                  checked
                    ? "border-sky-500 ring-1 ring-sky-500/40"
                    : "border-border hover:border-sky-500/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {payable && (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(inv.id)}
                      aria-label="Select invoice"
                      className="shrink-0"
                    />
                  )}
                  <Link
                    href={`/account/invoices/${inv.id}`}
                    className="group flex min-w-0 flex-1 items-center justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
                        <ReceiptIcon className="size-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-base font-bold tabular-nums text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                            {money(inv.amount)}
                          </p>
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatInvoiceNumber(inv.number)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {inv.organization?.name ? (
                            <span className="uppercase tracking-wide">
                              {inv.organization.name}
                            </span>
                          ) : null}
                          {inv.organization?.name && (inv.description || inv.item)
                            ? " · "
                            : ""}
                          {inv.description ||
                            (inv.item ? inv.item.title : "Formation")}{" "}
                          — {new Date(inv.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      {showBalance && (
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {money(remaining)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {paid > 0 ? "balance due" : "due"}
                          </p>
                        </div>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.className}`}
                      >
                        {st.label}
                      </span>
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                    </div>
                  </Link>
                </div>
                {inv.status === "partially_paid" && paid > 0 && (
                  <div className="mt-3 flex items-center gap-3 pl-15">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {money(paid)} of {money(inv.amount)} paid
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Combined pay bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={clear}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <XIcon className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {selected.size} invoice{selected.size === 1 ? "" : "s"} selected
            </p>
            <p className="text-xs text-muted-foreground">
              Total{" "}
              <span className="font-semibold text-foreground">
                {money(selectedTotal)}
              </span>
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setDialog("qr")}>
              Pay via Bangla QR
            </Button>
            <Button
              onClick={() => setDialog("wallet")}
              disabled={!enoughWallet}
              title={
                enoughWallet
                  ? undefined
                  : `Wallet has ${money(walletAvail)}, need ${money(selectedTotal)}`
              }
            >
              <WalletIcon className="size-4" />
              Pay with wallet
            </Button>
          </div>
        </div>
      )}

      {/* Wallet confirm dialog */}
      <Dialog
        open={dialog === "wallet"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay {selected.size} invoices from wallet</DialogTitle>
            <DialogDescription>
              {money(selectedTotal)} will be deducted from your wallet balance
              ({money(walletAvail)} available) and the selected invoices marked
              paid.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => payWallet.mutate({ invoiceIds })}
              disabled={payWallet.isPending}
            >
              {payWallet.isPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Paying…
                </>
              ) : (
                <>
                  <CheckIcon className="size-4" />
                  Pay {money(selectedTotal)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bangla QR combined dialog */}
      <Dialog open={dialog === "qr"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pay {selected.size} invoices</DialogTitle>
            <DialogDescription>
              Scan with any Bangla QR app (bKash, Nagad, Rocket, bank) and pay
              the combined total, then paste your transaction ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium">Total due</span>
              <div className="text-right">
                <p className="text-lg font-bold text-sky-500">
                  {money(selectedTotal)}
                </p>
                {bdtTotal && (
                  <p className="text-xs text-muted-foreground">৳{bdtTotal} BDT</p>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={QR_CONTENT} size={200} level="M" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Transaction ID (TrxID)</Label>
              <Input
                placeholder="Paste the transaction ID after paying"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                submitQr.mutate({
                  invoiceIds,
                  paymentMethod: "BanglaQR",
                  transactionId: txnId,
                })
              }
              disabled={!txnId.trim() || submitQr.isPending}
            >
              {submitQr.isPending ? "Submitting…" : "Confirm payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums text-foreground ${valueClass ?? ""}`}
      >
        {value}
      </p>
    </div>
  )
}
