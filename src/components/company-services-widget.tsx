"use client"

import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCartIcon, GlobeIcon } from "lucide-react"

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

const money = (n: number | null | undefined) => (n != null ? `$${n}` : "—")

export function CompanyServicesWidget({ orgId }: { orgId: string }) {
  const { data: orders, isLoading } =
    trpc.serviceOrders.listForCompany.useQuery(
      { organizationId: orgId },
      { enabled: !!orgId },
    )

  const list = orders ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ShoppingCartIcon className="size-4 text-sky-500" />
            Active services
          </span>
          {list.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {list.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No services ordered yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {list.map((o) => {
              const isWordpress = o.service?.type === "wordpress"
              const sp = STATUS_PILL[o.status] ?? STATUS_PILL.pending
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 ring-1 ring-inset ring-sky-500/20">
                      {isWordpress ? (
                        <GlobeIcon className="size-4" />
                      ) : (
                        <ShoppingCartIcon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {o.service?.title ?? "Service"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString()} ·{" "}
                        {money(o.invoice?.amount ?? o.service?.price)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${sp.cls}`}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {sp.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
