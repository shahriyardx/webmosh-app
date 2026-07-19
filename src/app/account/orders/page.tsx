"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { ShoppingCartIcon, ArrowRightIcon } from "lucide-react"

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  unpaid: {
    label: "Unpaid",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  processing: {
    label: "Processing",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  paid: {
    label: "Paid",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  },
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
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Orders
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          All service orders across your companies.
        </p>
      </div>

      {!orders?.length ? (
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
        <div className="grid gap-3">
          {orders.map((order) => {
            const svc = serviceMap.get(order.serviceId)
            const inv = order.invoice
            const st = inv
              ? STATUS_STYLES[inv.status] ?? STATUS_STYLES.unpaid
              : STATUS_STYLES.unpaid
            return (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-sky-500/40 hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
                    <ShoppingCartIcon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                      {svc?.title ?? "Unknown Service"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.organization?.name && (
                        <span className="uppercase tracking-wide">
                          {order.organization.name}
                        </span>
                      )}
                      {order.organization?.name && " · "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">
                    ${inv?.amount ?? "—"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.className}`}
                  >
                    {st.label}
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
