"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCartIcon, ArrowRightIcon } from "lucide-react"

const statusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

export default function AccountOrdersPage() {
  const { data: orders, isLoading } = trpc.serviceOrders.listForUser.useQuery()
  const { data: allServices } = trpc.services.list.useQuery()

  const serviceMap = new Map(allServices?.map((s) => [s.id, s]) ?? [])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All service orders across your companies.
        </p>
      </div>

      {!orders?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ShoppingCartIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => {
            const svc = serviceMap.get(order.serviceId)
            const inv = order.invoice
            const st = inv ? statusLabel[inv.status] ?? statusLabel.unpaid : statusLabel.unpaid
            return (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <ShoppingCartIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {svc?.title ?? "Unknown Service"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.organization?.name && (
                        <span className="uppercase">{order.organization.name}</span>
                      )}
                      {order.organization?.name && " · "}
                      ${inv?.amount ?? "—"} — {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
