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

export default function AccountInvoicesPage() {
  const { data: invoices, isLoading } = trpc.invoices.listForUser.useQuery()
  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()

  const unpaidTotal = (invoices ?? [])
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.amount, 0)

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
            Payments
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            All payments across your companies.
          </p>
        </div>
        {unpaidTotal > 0 && (
          <Link
            href="/account/wallet"
            className="group flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-2.5 transition-colors hover:bg-sky-500/10"
          >
            <WalletIcon className="size-4 text-sky-500" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">
                ${unpaidTotal.toFixed(2)} outstanding
              </p>
              <p className="text-muted-foreground">
                Wallet: ${(walletBalance?.available ?? 0).toFixed(2)} available
              </p>
            </div>
          </Link>
        )}
      </div>

      {!invoices?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <ReceiptIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No payments yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map((inv) => {
            const st = STATUS_STYLES[inv.status] ?? STATUS_STYLES.unpaid
            return (
              <Link
                key={inv.id}
                href={`/account/invoices/${inv.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-sky-500/40 hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
                    <ReceiptIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-bold tabular-nums text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        ${inv.amount}
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
                      {inv.description || (inv.item ? inv.item.title : "Formation")}{" "}
                      — {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.className}`}
                  >
                    {st.label}
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
