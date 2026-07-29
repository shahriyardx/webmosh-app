"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  ShoppingCartIcon,
  ArrowRightIcon,
  GlobeIcon,
  PackageIcon,
} from "lucide-react"

// Invoice payment status → ringed pill, matching the order pages' colour scheme.
const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  unpaid: {
    label: "Unpaid",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  processing: {
    label: "Processing",
    cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  paid: {
    label: "Paid",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  },
}

const money = (n: number | null | undefined) => (n != null ? `$${n}` : "—")

export default function OrdersPage() {
  const params = useParams()
  const companyId = typeof params?.companyId === "string" ? params.companyId : ""
  const { data: orders, isLoading } = trpc.serviceOrders.list.useQuery(
    { organizationId: companyId },
    { enabled: !!companyId },
  )
  const { data: allServices } = trpc.services.list.useQuery()

  const serviceMap = new Map(allServices?.map((s) => [s.id, s]) ?? [])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  const list = orders ?? []
  const paidCount = list.filter((o) => o.invoice?.status === "paid").length
  const unpaidCount = list.filter((o) => o.invoice?.status === "unpaid").length
  const totalValue = list.reduce(
    (sum, o) => sum + (o.invoice?.amount ?? 0),
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your service orders and payment status.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <ShoppingCartIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No orders yet.</p>
          <Button asChild size="sm">
            <Link href={`/companies/${companyId}/services`}>Browse Services</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total orders", value: String(list.length), accent: "" },
              {
                label: "Paid",
                value: String(paidCount),
                accent: "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Unpaid",
                value: String(unpaidCount),
                accent: "text-amber-600 dark:text-amber-400",
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
              const svc = serviceMap.get(order.serviceId)
              const inv = order.invoice
              const isWordpress = svc?.type === "wordpress"
              const st = STATUS_PILL[inv?.status ?? "unpaid"] ?? STATUS_PILL.unpaid
              return (
                <Link
                  key={order.id}
                  href={`/companies/${companyId}/orders/${order.id}`}
                  className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-sky-500/30 hover:shadow-md"
                >
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {svc?.title ?? "Unknown Service"}
                      </span>
                      {isWordpress && (
                        <span className="inline-flex shrink-0 items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500 ring-1 ring-inset ring-sky-500/25">
                          WP
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <span
                      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex ${st.cls}`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {st.label}
                    </span>
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {money(inv?.amount)}
                    </span>
                    <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-sky-500" />
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
