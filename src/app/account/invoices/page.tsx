"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ReceiptIcon, ArrowRightIcon } from "lucide-react"
import { formatInvoiceNumber } from "@/lib/invoice-number"

const statusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

export default function AccountInvoicesPage() {
  const { data: invoices, isLoading } = trpc.invoices.listForUser.useQuery()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All payments across your companies.
        </p>
      </div>

      {!invoices?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ReceiptIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {invoices.map((inv) => {
            const st = statusLabel[inv.status] ?? statusLabel.unpaid
            return (
              <Link
                key={inv.id}
                href={`/account/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <ReceiptIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium text-foreground">${inv.amount}</p>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatInvoiceNumber(inv.number)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inv.organization?.name ? (
                        <span className="uppercase">{inv.organization.name}</span>
                      ) : null}
                      {inv.organization?.name && (inv.description || inv.item) ? " · " : ""}
                      {inv.description || (inv.item ? inv.item.title : "Formation")} —{" "}
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
