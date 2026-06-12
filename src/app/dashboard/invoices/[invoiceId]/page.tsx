"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeftIcon, CheckIcon, CopyIcon } from "lucide-react"
import Link from "next/link"

const statusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

const paymentNumbers: Record<string, string> = {
  bkash: "01XXXXXXXXX",
  nagad: "01XXXXXXXXX",
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = use(params)
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id: invoiceId })

  const [selectedMethod, setSelectedMethod] = useState<"bkash" | "nagad" | null>(null)
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

  const handlePay = () => {
    if (!selectedMethod || !transactionId) return
    submitTx.mutate({ invoiceId, paymentMethod: selectedMethod, transactionId })
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Amount Due</CardTitle>
          <Badge variant={st.variant}>{st.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold">${invoice.amount}</p>

          {invoice.paymentMethod && (
            <div className="text-sm text-muted-foreground">
              Payment method: <span className="font-medium capitalize">{invoice.paymentMethod}</span>
            </div>
          )}
          {invoice.transactionId && (
            <div className="text-sm text-muted-foreground">
              Transaction ID: <span className="font-medium">{invoice.transactionId}</span>
            </div>
          )}
          {invoice.rejectReason && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">
              Rejected: {invoice.rejectReason}
            </div>
          )}
        </CardContent>
      </Card>

      {canPay && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pay Now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-3 text-sm font-medium">Select payment method</p>
              <div className="flex gap-3">
                {(["bkash", "nagad"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedMethod(method)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all ${
                      selectedMethod === method
                        ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                        : "border-border hover:border-amber-500/50"
                    }`}
                  >
                    {selectedMethod === method && <CheckIcon className="size-4 text-amber-500" />}
                    {method === "bkash" ? "bKash" : "Nagad"}
                  </button>
                ))}
              </div>
            </div>

            {selectedMethod && (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Send ${invoice.amount} to this number:
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-background px-3 py-2 text-sm font-medium">
                      {paymentNumbers[selectedMethod]}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      onClick={() => copyNumber(paymentNumbers[selectedMethod])}
                    >
                      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Transaction ID</label>
                  <Input
                    placeholder="Enter the transaction ID from your payment"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handlePay}
                  disabled={!transactionId || submitTx.isPending}
                >
                  {submitTx.isPending ? "Submitting…" : "Confirm Payment"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
