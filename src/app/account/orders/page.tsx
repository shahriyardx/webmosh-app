"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import {
  ShoppingCartIcon,
  EyeIcon,
  XCircleIcon,
  GlobeIcon,
  PackageIcon,
} from "lucide-react"

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
  const pendingCount = list.filter((o) => o.status === "pending").length
  const activeCount = list.filter((o) => o.status === "processing").length
  const totalValue = list.reduce(
    (sum, o) => sum + (o.invoice?.amount ?? o.service?.price ?? 0),
    0,
  )

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
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total orders", value: String(list.length), accent: "" },
              {
                label: "Pending",
                value: String(pendingCount),
                accent: "text-amber-600 dark:text-amber-400",
              },
              {
                label: "In progress",
                value: String(activeCount),
                accent: "text-sky-600 dark:text-sky-400",
              },
              { label: "Total value", value: money(totalValue), accent: "" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {s.label}
                </p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${s.accent || "text-foreground"}`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Order cards */}
          <div className="space-y-3">
            {list.map((order) => {
              const isWordpress = order.service?.type === "wordpress"
              const inv = order.invoice
              const st = STATUS_PILL[order.status] ?? STATUS_PILL.pending
              const canCancel =
                (order.status === "pending" ||
                  order.status === "awaiting_quote") &&
                (!inv ||
                  inv.status === "unpaid" ||
                  inv.status === "rejected")
              return (
                <div
                  key={order.id}
                  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-sky-500/30 hover:shadow-md sm:flex-row sm:items-center sm:gap-5"
                >
                  {/* Service + company */}
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                        isWordpress
                          ? "bg-sky-500/10 text-sky-500 ring-sky-500/20"
                          : "bg-muted text-muted-foreground ring-border"
                      }`}
                    >
                      {isWordpress ? (
                        <GlobeIcon className="size-5" />
                      ) : (
                        <PackageIcon className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">
                          {order.service?.title ?? "Service"}
                        </span>
                        {isWordpress && (
                          <span className="inline-flex shrink-0 items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500 ring-1 ring-inset ring-sky-500/25">
                            WP
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate uppercase tracking-wide">
                          {order.organization?.name ?? "—"}
                        </span>
                        {inv?.number != null && (
                          <>
                            <span className="text-border">•</span>
                            <Link
                              href={`/account/invoices/${inv.id}`}
                              className="shrink-0 font-mono underline-offset-2 hover:text-foreground hover:underline"
                            >
                              {formatInvoiceNumber(inv.number)}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status + amount */}
                  <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${st.cls}`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {st.label}
                    </span>
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {money(inv?.amount ?? order.service?.price)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      asChild
                    >
                      <Link href={`/account/orders/${order.id}`}>
                        <EyeIcon className="size-3.5" />
                        View
                      </Link>
                    </Button>
                    {canCancel && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-destructive hover:text-destructive sm:flex-none"
                        onClick={() =>
                          setCancelTarget({
                            id: order.id,
                            title: order.service?.title ?? "this order",
                          })
                        }
                      >
                        <XCircleIcon className="size-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
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
