"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { PaymentStatus } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ReceiptIcon } from "lucide-react"

const tabs = [
  { label: "All", value: undefined },
  { label: "Unpaid", value: PaymentStatus.unpaid },
  { label: "Processing", value: PaymentStatus.processing },
  { label: "Paid", value: PaymentStatus.paid },
] as const

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
}

export default function AdminInvoicesPage() {
  const [status, setStatus] = useState<PaymentStatus | undefined>(undefined)
  const [rejecting, setRejecting] = useState<{ id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const utils = trpc.useUtils()
  const { data: invoices, isLoading } = trpc.invoices.listAll.useQuery({ status })
  const approve = trpc.invoices.approve.useMutation({
    onSuccess: () => utils.invoices.listAll.invalidate(),
  })
  const reject = trpc.invoices.reject.useMutation({
    onSuccess: () => {
      utils.invoices.listAll.invalidate()
      setRejecting(null)
      setRejectReason("")
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage all formation invoices.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-amber-500/10 text-amber-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {invoices?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ReceiptIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No invoices found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((inv) => {
                const sb = statusBadge[inv.status] ?? statusBadge.unpaid
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.organization?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <p>${inv.amount}</p>
                      {inv.description && (
                        <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{inv.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {inv.paymentMethod ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {inv.transactionId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {inv.status === PaymentStatus.processing && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approve.mutate({ id: inv.id })}
                              disabled={approve.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejecting({ id: inv.id })}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {inv.status === PaymentStatus.unpaid && (
                          <span className="text-xs text-muted-foreground">Awaiting payment</span>
                        )}
                        {inv.status === PaymentStatus.paid && (
                          <span className="text-xs text-green-600">Completed</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Reject Invoice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide a reason for rejection.
            </p>
            <textarea
              className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
              rows={3}
              placeholder="e.g. Invalid transaction ID"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejecting(null); setRejectReason("") }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => reject.mutate({ id: rejecting.id, reason: rejectReason })}
                disabled={!rejectReason || reject.isPending}
              >
                {reject.isPending ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
