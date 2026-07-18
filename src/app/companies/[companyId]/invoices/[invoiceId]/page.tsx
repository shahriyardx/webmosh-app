"use client"

import { use, useState } from "react"
import { useParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeftIcon, DownloadIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { formatInvoiceNumber } from "@/lib/invoice-number"

const QR_CONTENT =
  "00020101021126540013com.pathaopay01020302041008031991008200186593649045204739953030505802BD5907WEBMOSH60045460625002110186593649003085594973007082f9893880807PAYMENT63049E3F"

const statusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = use(params)
  const routeParams = useParams()
  const companyId = typeof routeParams?.companyId === "string" ? routeParams.companyId : ""
  const utils = trpc.useUtils()

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id: invoiceId })
  type EnrichedInvoice = NonNullable<typeof invoice> & {
    item: { type: "service" | "package"; title: string } | null
  }
  const { data: settings } = trpc.settings.getAll.useQuery()

  const [transactionId, setTransactionId] = useState("")

  const submitTx = trpc.invoices.submitTransaction.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate({ organizationId: companyId })
      utils.invoices.getById.invalidate({ id: invoiceId })
      setTransactionId("")
    },
  })

  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()
  const payWithWallet = trpc.wallet.payInvoice.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate({ organizationId: companyId })
      utils.invoices.getById.invalidate({ id: invoiceId })
      utils.wallet.myBalance.invalidate()
      utils.wallet.myTransactions.invalidate()
      toast.success("Invoice paid from your wallet balance")
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Payment not found.</p>
      </div>
    )
  }

  const st = statusLabel[invoice.status] ?? statusLabel.unpaid
  const canPay = invoice.status === "unpaid"
  const invItem = (invoice as EnrichedInvoice).item
  const rate = settings?.usd_to_bdt_rate ? parseFloat(settings.usd_to_bdt_rate) : null
  const bdtAmount = rate ? (invoice.amount * rate).toFixed(2) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href={`/companies/${companyId}/invoices`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            Payment {formatInvoiceNumber(invoice.number)}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">{invoice.id}</p>
        </div>
        <Button variant="outline" asChild>
          <a href={`/companies/${companyId}/invoices/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer">
            <DownloadIcon className="size-4" />
            Download
          </a>
        </Button>
      </div>

      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-sm font-semibold">Amount Due</span>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-3xl font-bold">${invoice.amount}</p>
            {bdtAmount && (
              <p className="mt-1 text-sm text-muted-foreground">
                ৳{bdtAmount} BDT
              </p>
            )}
          </div>

          {invoice.description && (
            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              {invoice.description}
            </div>
          )}

          {invItem && (
            <div className="border-t border-border pt-4 text-sm text-muted-foreground">
              {invItem.type === "service" ? "Service" : "Package"}:{" "}
              <span className="font-medium text-foreground">{invItem.title}</span>
            </div>
          )}

          {invoice.paymentMethod === "stripe" && (
            <div className="text-sm text-muted-foreground">
              Paid via <span className="font-medium">Stripe</span>
            </div>
          )}
          {invoice.paymentMethod && invoice.paymentMethod !== "stripe" && (
            <div className="text-sm text-muted-foreground">
              Payment method: <span className="font-medium capitalize">{invoice.paymentMethod}</span>
            </div>
          )}
          {invoice.transactionId && (
            <div className="text-sm text-muted-foreground">
              Transaction ID: <span className="font-medium">{invoice.transactionId}</span>
            </div>
          )}
          {(invoice.status === "rejected" || invoice.status === "unpaid") && invoice.rejectReason && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">
              {invoice.rejectReason}
            </div>
          )}
        </div>
      </div>

      {canPay && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5">
          <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
                <WalletIcon className="size-5 text-sky-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Pay with wallet balance</p>
                <p className="text-xs text-muted-foreground">
                  Available: ${(walletBalance?.available ?? 0).toFixed(2)}
                  {(walletBalance?.available ?? 0) < invoice.amount &&
                    " — not enough for this invoice"}
                </p>
              </div>
            </div>
            {(walletBalance?.available ?? 0) >= invoice.amount ? (
              <Button
                disabled={payWithWallet.isPending}
                onClick={() => payWithWallet.mutate({ invoiceId })}
              >
                {payWithWallet.isPending
                  ? "Paying…"
                  : `Pay $${invoice.amount} now`}
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/account/wallet">Add money</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {canPay && (
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-5 py-3.5">
            <span className="text-sm font-semibold">Pay with Bangla QR</span>
          </div>
          <div className="space-y-5 px-5 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={QR_CONTENT} size={220} level="M" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Scan with any Bangla QR enabled app (bKash, Nagad, Rocket, bank app) and pay{" "}
                {bdtAmount ? <strong>৳{bdtAmount}</strong> : <strong>${invoice.amount}</strong>}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Transaction ID (TrxID)</Label>
              <Input
                placeholder="Paste the transaction ID after paying"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => submitTx.mutate({ invoiceId, paymentMethod: "BanglaQR", transactionId })}
              disabled={!transactionId || submitTx.isPending}
            >
              {submitTx.isPending ? "Submitting…" : "Confirm Payment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
