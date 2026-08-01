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
  Building2Icon,
  UserIcon,
  FileTextIcon,
  DownloadIcon,
} from "lucide-react"

const DOC_STATUS: Record<string, string> = {
  approved:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  submitted: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  requested:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
}

function KV({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">
        {value || "—"}
      </p>
    </div>
  )
}

const countryLabel = (c: string | null) =>
  c === "uk" ? "United Kingdom" : c === "us" ? "United States" : "—"

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
  // Full company details (+ directors) for the attached company, if any.
  const { data: company } = trpc.companies.getById.useQuery(
    { id: order?.organizationId ?? "" },
    { enabled: !!order?.organizationId },
  )

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

      {/* Attached company — full details + directors */}
      {company && company.type !== "personal" && (
        <>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Building2Icon className="size-4 text-sky-500" />
              Company details
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KV label="Company" value={company.name} />
              <KV label="Country" value={countryLabel(company.country)} />
              <KV label="Company number" value={company.companyId} />
              <KV
                label="Status"
                value={
                  company.status.charAt(0).toUpperCase() +
                  company.status.slice(1)
                }
              />
              {company.state && <KV label="State" value={company.state} />}
              {company.ein && <KV label="EIN" value={company.ein} />}
              {company.sicCode && (
                <KV label="SIC code" value={company.sicCode} />
              )}
            </div>
            {company.registeredAddress && (
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Registered address
                </p>
                <p className="mt-0.5 whitespace-pre-line text-sm font-medium">
                  {company.registeredAddress}
                </p>
              </div>
            )}
            {company.website && (
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Website
                </p>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 block break-all text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  {company.website}
                </a>
              </div>
            )}
          </div>

          {company.directors.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <UserIcon className="size-4 text-sky-500" />
                Directors
              </p>
              {company.directors.map((d) => (
                <div
                  key={d.id}
                  className="grid gap-3 border-t border-border pt-3 first:border-0 first:pt-0 sm:grid-cols-2"
                >
                  <KV label="Name" value={`${d.firstName} ${d.lastName}`} />
                  <KV label="Email" value={d.email} />
                  <KV label="Phone" value={d.phone} />
                  <KV label="Date of birth" value={d.dateOfBirth} />
                  <div className="sm:col-span-2">
                    <KV label="Address" value={d.address} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {company.documents.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileTextIcon className="size-4 text-sky-500" />
                Documents
              </p>
              <div className="divide-y divide-border">
                {company.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {doc.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${
                          DOC_STATUS[doc.status] ??
                          "bg-muted text-muted-foreground ring-border"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>
                    {doc.value ? (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={doc.value}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <DownloadIcon className="size-3.5" />
                          View
                        </a>
                      </Button>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Not submitted
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

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
