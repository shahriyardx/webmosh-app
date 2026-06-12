"use client"

import { use } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, ShoppingCartIcon, CheckIcon } from "lucide-react"

const invStatusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

const orderStatusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)

  const { data: order, isLoading } = trpc.serviceOrders.getById.useQuery({ id: orderId })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </div>
    )
  }

  const inv = order.invoice
  const svc = order.service
  const st = inv ? invStatusLabel[inv.status] ?? invStatusLabel.unpaid : undefined
  const os = orderStatusLabel[order.status] ?? orderStatusLabel.pending

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/dashboard/orders">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Order</h1>
          <p className="text-xs text-muted-foreground font-mono">{order.id}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-sm font-semibold">Service</span>
          <Badge variant={os.variant}>{os.label}</Badge>
        </div>
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-amber-500/10">
            <ShoppingCartIcon className="size-6 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{svc?.title ?? "Unknown Service"}</p>
            {svc?.price && (
              <p className="text-sm text-muted-foreground">${svc.price}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-sm font-semibold">Invoice</span>
          {st && <Badge variant={st.variant}>{st.label}</Badge>}
        </div>
        <div className="space-y-4 px-5 py-4">
          {inv ? (
            <>
              <p className="text-3xl font-bold">${inv.amount}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {inv.id}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Invoice not available</p>
          )}
        </div>
      </div>

      {inv?.status === "unpaid" && (
        <Button asChild className="w-full">
          <Link href={`/dashboard/invoices/${inv.id}`}>
            <CheckIcon className="mr-1.5 size-4" />
            Pay Now
          </Link>
        </Button>
      )}
    </div>
  )
}
