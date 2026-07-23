"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { InvoiceSummaryCard } from "@/components/invoice-summary-card"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import {
  ArrowLeftIcon,
  DownloadIcon,
  CheckIcon,
  XIcon,
  BellIcon,
  Trash2Icon,
  ReceiptIcon,
} from "lucide-react"

const paymentStatusStyle: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-500",
  pending: "bg-amber-500/15 text-amber-500",
  rejected: "bg-red-500/15 text-red-500",
}

function txLabel(type: string, method: string | null) {
  if (type === "invoice_payment") return `Wallet payment`
  if (type === "external_payment") return `${method ?? "External"} payment`
  return type
}

export default function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id })
  const { data: settings } = trpc.settings.getAll.useQuery()
  const { data: payState } = trpc.invoices.paymentState.useQuery({
    invoiceId: id,
  })

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    utils.invoices.getById.invalidate({ id })
    utils.invoices.paymentState.invalidate({ invoiceId: id })
    utils.invoices.listAll.invalidate()
  }

  const approve = trpc.invoices.approve.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Payment approved")
    },
    onError: (e) => toast.error(e.message),
  })
  const reject = trpc.invoices.reject.useMutation({
    onSuccess: () => {
      invalidate()
      setRejectOpen(false)
      setRejectReason("")
      toast.success("Payment rejected")
    },
    onError: (e) => toast.error(e.message),
  })
  const sendReminder = trpc.invoices.sendReminder.useMutation({
    onSuccess: () => toast.success("Reminder email sent"),
    onError: (e) => toast.error(e.message),
  })
  const del = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted")
      router.push("/admin/invoices")
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
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      </div>
    )
  }

  const rate = settings?.usd_to_bdt_rate
    ? parseFloat(settings.usd_to_bdt_rate)
    : null
  const isProcessing = invoice.status === "processing"
  const payments = payState?.payments ?? []

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/invoices">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground">
            Invoice {formatInvoiceNumber(invoice.number)}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">{invoice.id}</p>
        </div>
        <Button variant="outline" asChild>
          <a
            href={`/companies/${invoice.organizationId}/invoices/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <DownloadIcon className="size-4" />
            Download
          </a>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* Detailed invoice */}
        <div className="space-y-6">
          <InvoiceSummaryCard invoice={invoice} bdtRate={rate} />

          {/* Payment history */}
          {payments.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
                  <ReceiptIcon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Payment history</span>
                </div>
                <div className="divide-y divide-border">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {txLabel(p.type, p.method)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.transactionId ? `${p.transactionId} · ` : ""}
                          {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          ${p.amount.toFixed(2)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            paymentStatusStyle[p.status] ?? ""
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Admin actions */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </h2>

              {isProcessing && (
                <>
                  <p className="text-xs text-muted-foreground">
                    A payment was submitted and needs verification.
                  </p>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-600/90"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ id })}
                  >
                    <CheckIcon className="size-4" />
                    Approve payment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-500 hover:text-red-500"
                    onClick={() => setRejectOpen(true)}
                  >
                    <XIcon className="size-4" />
                    Reject payment
                  </Button>
                  <div className="my-1 h-px bg-border" />
                </>
              )}

              {invoice.status !== "paid" && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={sendReminder.isPending}
                  onClick={() => sendReminder.mutate({ id })}
                >
                  <BellIcon className="size-4" />
                  {sendReminder.isPending ? "Sending…" : "Send reminder"}
                </Button>
              )}
              <Button variant="outline" asChild className="w-full">
                <a
                  href={`/companies/${invoice.organizationId}/invoices/${id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DownloadIcon className="size-4" />
                  Download PDF
                </a>
              </Button>
              <Button
                variant="outline"
                className="w-full text-red-500 hover:text-red-500"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Delete invoice
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              The invoice returns to unpaid and the customer is notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Transaction ID not found"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => reject.mutate({ id, reason: rejectReason.trim() })}
            >
              {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete invoice"
        description="Delete this invoice? It will be hidden and excluded from revenue. This cannot be undone."
        onConfirm={() => del.mutate({ id })}
        loading={del.isPending}
      />
    </div>
  )
}
