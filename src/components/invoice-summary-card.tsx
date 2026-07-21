"use client"

import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Badge } from "@/components/ui/badge"
import { formatInvoiceNumber } from "@/lib/invoice-number"

type Invoice = NonNullable<
  inferRouterOutputs<AppRouter>["invoices"]["getById"]
>

type LineItem = { title: string; amount: number }

const statusMeta: Record<
  string,
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  partially_paid: { label: "Partially paid", variant: "secondary" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

/**
 * Detailed, itemized invoice card: issue date, billed-to, line items and a
 * subtotal → discount → total breakdown, plus payment details. Shared by the
 * account and company invoice pages.
 */
export function InvoiceSummaryCard({
  invoice,
  bdtRate,
}: {
  invoice: Invoice
  bdtRate: number | null
}) {
  const st = statusMeta[invoice.status] ?? statusMeta.unpaid

  const lineItems = Array.isArray(invoice.items)
    ? (invoice.items as unknown as LineItem[]).filter(
        (i) => i && typeof i.amount === "number",
      )
    : []

  const itemsSubtotal = lineItems.reduce((s, i) => s + i.amount, 0)
  const discount = invoice.discountAmount ?? 0
  const subtotal =
    invoice.originalAmount ?? (lineItems.length ? itemsSubtotal : invoice.amount)
  const amountPaid = invoice.amountPaid ?? 0
  const remaining = Math.max(0, Math.round((invoice.amount - amountPaid) * 100) / 100)
  const isPaid = invoice.status === "paid"
  const hasBreakdown = lineItems.length > 0 || discount > 0 || amountPaid > 0
  const dueAmount = isPaid ? invoice.amount : remaining
  const bdtAmount = bdtRate ? (dueAmount * bdtRate).toFixed(2) : null

  const issued = new Date(invoice.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const paidOn =
    invoice.status === "paid"
      ? new Date(invoice.updatedAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null

  const itemFallback = invoice.item
    ? `${invoice.item.type === "service" ? "Service" : "Package"}: ${invoice.item.title}`
    : invoice.description

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Invoice {formatInvoiceNumber(invoice.number)}
          </p>
          <p className="text-xs text-muted-foreground">Issued {issued}</p>
        </div>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      {/* Billed to */}
      {(invoice.receiverName || invoice.receiverEmail) && (
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Billed to
          </p>
          {invoice.receiverName && (
            <p className="mt-1 text-sm font-medium text-foreground">
              {invoice.receiverName}
            </p>
          )}
          {invoice.receiverEmail && (
            <p className="text-xs text-muted-foreground">
              {invoice.receiverEmail}
            </p>
          )}
        </div>
      )}

      {/* Line items */}
      <div className="px-5 py-4">
        {lineItems.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Description</span>
              <span>Amount</span>
            </div>
            {lineItems.map((li, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <span className="text-foreground">{li.title}</span>
                <span className="shrink-0 font-medium text-foreground">
                  {money(li.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : itemFallback ? (
          <p className="text-sm text-muted-foreground">{itemFallback}</p>
        ) : null}

        {/* Totals */}
        <div className="mt-4 space-y-1.5 border-t border-border pt-4">
          {hasBreakdown && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex items-center justify-between text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <span>
                Discount{invoice.couponCode ? ` (${invoice.couponCode})` : ""}
              </span>
              <span>−{money(discount)}</span>
            </div>
          )}
          {(discount > 0 || amountPaid > 0) && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total</span>
              <span>{money(invoice.amount)}</span>
            </div>
          )}
          {amountPaid > 0 && (
            <div className="flex items-center justify-between text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <span>Amount paid</span>
              <span>−{money(amountPaid)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm font-semibold text-foreground">
              {isPaid ? "Amount paid" : amountPaid > 0 ? "Balance due" : "Amount due"}
            </span>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
                {money(dueAmount)}
              </p>
              {bdtAmount && (
                <p className="text-xs text-muted-foreground">
                  ৳{bdtAmount} BDT
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment details */}
      {(invoice.paymentMethod || invoice.transactionId || paidOn) && (
        <div className="space-y-1.5 border-t border-border bg-muted/20 px-5 py-4 text-sm">
          {invoice.paymentMethod && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Payment method</span>
              <span className="font-medium capitalize text-foreground">
                {invoice.paymentMethod}
              </span>
            </div>
          )}
          {invoice.transactionId && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Transaction ID</span>
              <span className="max-w-[60%] truncate font-medium text-foreground">
                {invoice.transactionId}
              </span>
            </div>
          )}
          {paidOn && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Paid on</span>
              <span className="font-medium text-foreground">{paidOn}</span>
            </div>
          )}
        </div>
      )}

      {/* Reject / unpaid reason */}
      {(invoice.status === "rejected" || invoice.status === "unpaid") &&
        invoice.rejectReason && (
          <div className="border-t border-border px-5 py-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">
              {invoice.rejectReason}
            </div>
          </div>
        )}
    </div>
  )
}
