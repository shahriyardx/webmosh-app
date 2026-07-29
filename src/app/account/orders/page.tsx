"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import { ShoppingCartIcon, EyeIcon, XCircleIcon } from "lucide-react"

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "Pending",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  processing: {
    label: "In progress",
    cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  completed: {
    label: "Completed",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  awaiting_quote: {
    label: "Awaiting quote",
    cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20",
  },
}

const money = (n: number | null | undefined) =>
  n != null ? `$${n}` : "—"

export default function AccountOrdersPage() {
  const utils = trpc.useUtils()
  const { data: orders, isLoading } = trpc.serviceOrders.listForUser.useQuery()
  const [cancelTarget, setCancelTarget] = useState<{
    id: string
    title: string
  } | null>(null)

  const cancel = trpc.serviceOrders.cancel.useMutation({
    onSuccess: () => {
      utils.serviceOrders.listForUser.invalidate()
      utils.invoices.listForUser.invalidate()
      setCancelTarget(null)
      toast.success("Order cancelled")
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

  const list = orders ?? []

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Orders
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          All service orders across your companies.
        </p>
      </div>

      {!list.length ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <ShoppingCartIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No orders yet.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Browse the services catalog to place your first order.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((order) => {
                const isWordpress = order.service?.type === "wordpress"
                const inv = order.invoice
                const st =
                  STATUS_PILL[order.status] ?? STATUS_PILL.pending
                const canCancel =
                  (order.status === "pending" ||
                    order.status === "awaiting_quote") &&
                  (!inv ||
                    inv.status === "unpaid" ||
                    inv.status === "rejected")
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{order.service?.title ?? "Service"}</span>
                        {isWordpress && (
                          <span className="inline-flex items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500 ring-1 ring-inset ring-sky-500/25">
                            WP
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="uppercase text-muted-foreground">
                      {order.organization?.name ?? "—"}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {money(inv?.amount ?? order.service?.price)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {inv?.number != null ? (
                        <Link
                          href={`/account/invoices/${inv.id}`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {formatInvoiceNumber(inv.number)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/account/orders/${order.id}`}>
                            <EyeIcon className="size-3.5" />
                            View
                          </Link>
                        </Button>
                        {canCancel && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              setCancelTarget({
                                id: order.id,
                                title: order.service?.title ?? "this order",
                              })
                            }
                          >
                            <XCircleIcon className="size-3.5" />
                            Cancel Order
                          </Button>
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

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>
              Cancel your order for{" "}
              <span className="font-medium text-foreground">
                {cancelTarget?.title}
              </span>
              ? This removes the order and its unpaid invoice. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
            >
              Keep order
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() =>
                cancelTarget && cancel.mutate({ id: cancelTarget.id })
              }
            >
              {cancel.isPending ? "Cancelling…" : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
