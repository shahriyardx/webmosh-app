"use client"

import { use } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AdminOrderDetails } from "@/components/admin-order-details"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  ReceiptIcon,
  ExternalLinkIcon,
} from "lucide-react"

const statusBadge: Record<
  string,
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  awaiting_quote: { label: "Awaiting quote", variant: "destructive" },
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: order, isLoading } = trpc.serviceOrders.adminGetById.useQuery({
    id,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </div>
    )
  }

  const sb = statusBadge[order.status] ?? statusBadge.pending
  const isWordpress = order.service?.type === "wordpress"

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild className="size-9 shrink-0">
          <Link href="/admin/orders">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Order</h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {order.id}
          </p>
        </div>
        <Badge variant={sb.variant}>{sb.label}</Badge>
      </div>

      {/* Service hero */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
            <ShoppingCartIcon className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {order.organization?.name ?? "Service"}
            </p>
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-semibold text-foreground">
                {order.service?.title ?? "Unknown service"}
              </p>
              {isWordpress && (
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-500">
                  WordPress
                </span>
              )}
            </div>
          </div>
          {order.service?.price != null && (
            <p className="shrink-0 text-2xl font-bold tabular-nums text-foreground">
              ${order.service.price}
            </p>
          )}
        </div>
      </div>

      {/* Full details */}
      <AdminOrderDetails order={order} />

      {/* Invoice link */}
      {order.invoice && (
        <Button asChild variant="outline" className="w-full">
          <Link href="/admin/invoices">
            <ReceiptIcon className="mr-1.5 size-4" />
            Invoice {formatInvoiceNumber(order.invoice.number)} · $
            {order.invoice.amount}
            <ExternalLinkIcon className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      )}
    </div>
  )
}
