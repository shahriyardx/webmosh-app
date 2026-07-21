"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { ReceiptIcon, ArrowRightIcon, WalletIcon } from "lucide-react"
import { formatInvoiceNumber } from "@/lib/invoice-number"

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
  const { data: invoices, isLoading } = trpc.invoices.listForUser.useQuery()
  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()

  const list = invoices ?? []
  const totalInvoiced = list.reduce((s, i) => s + i.amount, 0)
  const totalPaid = list.reduce(
    (s, i) => s + (i.status === "paid" ? i.amount : (i.amountPaid ?? 0)),
    0,
  )
  const outstanding = list
    .filter((i) => i.status === "unpaid" || i.status === "partially_paid")
    .reduce((s, i) => s + Math.max(0, i.amount - (i.amountPaid ?? 0)), 0)

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            All invoices across your companies.
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
                Wallet: {money(walletBalance?.available ?? 0)} available
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
            const showBalance =
              (inv.status === "unpaid" || inv.status === "partially_paid") &&
              remaining > 0
            const pct =
              inv.amount > 0 ? Math.min(100, (paid / inv.amount) * 100) : 0
            return (
              <Link
                key={inv.id}
                href={`/account/invoices/${inv.id}`}
                className="group rounded-2xl border border-border bg-card p-4 transition-all hover:border-sky-500/40 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-4">
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
              </Link>
            )
          })}
        </div>
      )}
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
