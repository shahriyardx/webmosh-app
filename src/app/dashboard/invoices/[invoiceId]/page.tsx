"use client"

import { use, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeftIcon, CheckIcon, CopyIcon, Loader2Icon } from "lucide-react"
import Link from "next/link"

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
  const utils = trpc.useUtils()

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id: invoiceId })
  type EnrichedInvoice = NonNullable<typeof invoice> & {
    item: { type: "service" | "package"; title: string } | null
  }
  const { data: settings } = trpc.settings.getAll.useQuery()

  const [selectedMethod, setSelectedMethod] = useState<"stripe" | "bkash" | null>(null)
  const [transactionId, setTransactionId] = useState("")
  const [copied, setCopied] = useState(false)

  const submitTx = trpc.invoices.submitTransaction.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate()
      utils.invoices.getById.invalidate({ id: invoiceId })
      setSelectedMethod(null)
      setTransactionId("")
    },
  })

  const createSession = trpc.invoices.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
  })

  const handleStripePay = () => {
    createSession.mutate({
      invoiceId,
      successUrl: `${window.location.origin}/dashboard/invoices/${invoiceId}/success`,
      cancelUrl: window.location.href,
    })
  }

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      </div>
    )
  }

  const st = statusLabel[invoice.status] ?? statusLabel.unpaid
  const canPay = invoice.status === "unpaid"
  const invItem = (invoice as EnrichedInvoice).item
  const rate = settings?.usd_to_bdt_rate ? parseFloat(settings.usd_to_bdt_rate) : null
  const bdtAmount = rate ? (invoice.amount * rate).toFixed(2) : null
  const bkashNumber = settings?.bkash_number ?? ""

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/dashboard/invoices">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoice</h1>
          <p className="text-xs text-muted-foreground font-mono">{invoice.id}</p>
        </div>
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
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-5 py-3.5">
            <span className="text-sm font-semibold">Pay Now</span>
          </div>
          <div className="space-y-5 px-5 py-4">
            <p className="text-sm font-medium">Select payment method</p>

            {/* Method selection */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod("stripe")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all ${
                  selectedMethod === "stripe"
                    ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                    : "border-border hover:border-amber-500/50"
                }`}
              >
                {selectedMethod === "stripe" && <CheckIcon className="size-4 text-amber-500" />}
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <title>Stripe</title>
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.725 15.639 0 12.475 0 9.132 0 6.652 1.418 6.652 4.315c0 3.29 4.319 4.591 7.324 5.405 2.234.604 3.356 1.484 3.356 2.5 0 .93-.896 1.511-2.355 1.511-2.45 0-5.09-1.226-6.89-2.242l-.93 5.535c1.612.85 3.947 1.586 6.508 1.586 4.179 0 6.797-1.966 6.797-5.056 0-3.631-4.603-4.996-7.496-5.896z"/>
                </svg>
                Stripe
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod("bkash")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all ${
                  selectedMethod === "bkash"
                    ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                    : "border-border hover:border-amber-500/50"
                }`}
              >
                {selectedMethod === "bkash" && <CheckIcon className="size-4 text-amber-500" />}
                <span className="text-base font-bold" style={{ color: "#E2136E" }}>bKash</span>
              </button>
            </div>

            {/* Stripe action */}
            {selectedMethod === "stripe" && (
              <Button
                className="w-full"
                onClick={handleStripePay}
                disabled={createSession.isPending}
              >
                {createSession.isPending ? (
                  <>
                    <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                    Redirecting to Stripe…
                  </>
                ) : (
                  <>
                    <svg className="mr-1.5 size-4" viewBox="0 0 24 24" fill="currentColor">
                      <title>Stripe</title>
                      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.725 15.639 0 12.475 0 9.132 0 6.652 1.418 6.652 4.315c0 3.29 4.319 4.591 7.324 5.405 2.234.604 3.356 1.484 3.356 2.5 0 .93-.896 1.511-2.355 1.511-2.45 0-5.09-1.226-6.89-2.242l-.93 5.535c1.612.85 3.947 1.586 6.508 1.586 4.179 0 6.797-1.966 6.797-5.056 0-3.631-4.603-4.996-7.496-5.896z"/>
                    </svg>
                    Pay with Stripe
                  </>
                )}
              </Button>
            )}

            {/* bKash action */}
            {selectedMethod === "bkash" && bkashNumber && (
              <>
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Send money to this bKash number:</p>
                  <div className="flex items-center gap-2">
                    <Input value={bkashNumber} readOnly />
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      onClick={() => copyNumber(bkashNumber)}
                    >
                      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                    </Button>
                  </div>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. Open your bKash app</li>
                    <li>2. Select &quot;Send Money&quot;</li>
                    <li>3. Enter the number above as recipient</li>
                    <li>4. Enter amount: {bdtAmount ? <strong>৳{bdtAmount}</strong> : <strong>${invoice.amount}</strong>}</li>
                    <li>5. Enter your PIN and confirm</li>
                    <li>6. Copy the transaction ID (TrxID) and paste below</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <Label>Transaction ID (TrxID)</Label>
                  <Input
                    placeholder="Paste the transaction ID from bKash"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => submitTx.mutate({ invoiceId, paymentMethod: "bkash", transactionId })}
                  disabled={!transactionId || submitTx.isPending}
                >
                  {submitTx.isPending ? "Submitting…" : "Confirm Payment"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
