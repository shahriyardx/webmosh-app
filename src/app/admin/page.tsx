"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Building2Icon,
  UsersIcon,
  DollarSignIcon,
  FileTextIcon,
  ReceiptIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ClipboardListIcon,
  LifeBuoyIcon,
  CheckIcon,
  XIcon,
  ExternalLinkIcon,
  ShoppingCartIcon,
} from "lucide-react"

const filingStatusStyles: Record<string, string> = {
  requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  submitted: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  approved:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  open: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  completed:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  closed: "bg-muted text-muted-foreground ring-border",
}

function FilingStatusPill({ status }: { status: string }) {
  const cls =
    filingStatusStyles[status] ?? "bg-muted text-muted-foreground ring-border"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  )
}

const priorityStyles: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
}

function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${priorityStyles[priority]}`}
    >
      {priority}
    </span>
  )
}

const bucketLabels: Record<"overdue" | "d30" | "d60" | "d90", string> = {
  overdue: "Overdue",
  d30: "Next 30 days",
  d60: "31–60 days",
  d90: "61–90 days",
}
const bucketStyles: Record<"overdue" | "d30" | "d60" | "d90", string> = {
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  d30: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  d60: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  d90: "bg-muted text-muted-foreground ring-border",
}

/** Neutral bordered icon-chip section header, matching the other dashboards. */
function SectionTitle({
  icon: Icon,
  iconClass = "text-muted-foreground",
  children,
}: {
  icon: typeof Building2Icon
  iconClass?: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
        <Icon className={`size-4 ${iconClass}`} />
      </span>
      {children}
    </span>
  )
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = trpc.companies.getStats.useQuery()
  const { data: compliance } = trpc.admin.complianceDeadlines.useQuery()
  const { data: activity } = trpc.admin.recentActivity.useQuery()
  const { data: tasks } = trpc.admin.taskManager.useQuery()
  const { data: docsToReview, refetch: refetchDocs } =
    trpc.admin.docsToReview.useQuery()
  const { data: invoicesToReview, refetch: refetchInvoices } =
    trpc.admin.invoicesToReview.useQuery()
  const { data: recentOrders } = trpc.admin.recentOrders.useQuery()
  const { data: recentTickets } = trpc.admin.recentTickets.useQuery()

  const [bucket, setBucket] = useState<"overdue" | "d30" | "d60" | "d90">(
    "overdue",
  )

  const [rejectDoc, setRejectDoc] = useState<{ id: string; name: string } | null>(
    null,
  )
  const [rejectInvoice, setRejectInvoice] = useState<{
    id: string
    amount: number
  } | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const reviewDoc = trpc.companies.reviewDocument.useMutation({
    onSuccess: (_r, vars) => {
      refetchDocs()
      setRejectDoc(null)
      setRejectReason("")
      toast.success(
        vars.status === "approved" ? "Document approved" : "Document rejected",
      )
    },
    onError: (e) => toast.error(e.message),
  })

  const approveInvoice = trpc.invoices.approve.useMutation({
    onSuccess: () => {
      refetchInvoices()
      toast.success("Payment approved")
    },
    onError: (e) => toast.error(e.message),
  })
  const rejectInvoiceMut = trpc.invoices.reject.useMutation({
    onSuccess: () => {
      refetchInvoices()
      setRejectInvoice(null)
      setRejectReason("")
      toast.success("Payment rejected")
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading || !stats) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  const bucketItems =
    compliance?.items.filter((i) => i.bucket === bucket) ?? []

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const attentionCount =
    (docsToReview?.length ?? 0) +
    (invoicesToReview?.filter((i) => i.status === "processing").length ?? 0)

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
            {today}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Overview of formations, revenue, and items needing attention.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/formations">
              <Building2Icon className="size-4" />
              Formations
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/invoices">
              <ReceiptIcon className="size-4" />
              Invoices
            </Link>
          </Button>
        </div>
      </div>

      {/* Revenue hero */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <DollarSignIcon className="size-4" />
              Total revenue
            </p>
            <p className="mt-2 text-5xl font-bold tracking-tight">
              ${stats.revenue.toLocaleString()}
              <span className="ml-2 align-middle text-base font-medium text-slate-400">
                USD
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-400">
              From paid invoices ·{" "}
              {attentionCount > 0 ? (
                <span className="text-amber-300">
                  {attentionCount} item{attentionCount === 1 ? "" : "s"} need
                  attention
                </span>
              ) : (
                <span className="text-emerald-300">All caught up</span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-inset ring-white/10">
            <HeroStat
              icon={Building2Icon}
              label="Formations"
              value={stats.totalFormations}
              hint={`${stats.pendingFormations} pending`}
              href="/admin/formations"
            />
            <HeroStat
              icon={UsersIcon}
              label="Users"
              value={stats.totalUsers}
              hint="Registered"
              href="/admin/users"
            />
            <HeroStat
              icon={CheckIcon}
              label="Completed"
              value={stats.completedFormations}
              hint="Finished"
              href="/admin/formations"
            />
          </div>
        </div>
      </div>

      {/* Needs attention: 4 expanded widgets */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangleIcon className="size-4 text-amber-500" />
          <h2 className="text-base font-semibold text-foreground">
            Needs attention
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Documents to review */}
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <SectionTitle icon={FileTextIcon}>Documents</SectionTitle>
                <Badge variant={docsToReview?.length ? "default" : "outline"}>
                  {docsToReview?.length ?? 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!docsToReview?.length ? (
                <p className="py-6 text-center text-base text-muted-foreground">
                  Nothing awaiting review.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {docsToReview.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium">
                            {d.name}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            <span className="uppercase">
                              {d.organization?.name ?? "—"}
                            </span>
                            {d.directorNames && d.directorNames.length > 0 && (
                              <> · {d.directorNames.join(", ")}</>
                            )}
                          </p>
                        </div>
                        {d.value && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 gap-1 px-2"
                            asChild
                          >
                            <a
                              href={d.value}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLinkIcon className="size-3.5" />
                              View
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1 gap-1 px-2 text-emerald-500 hover:text-emerald-500"
                          disabled={reviewDoc.isPending}
                          onClick={() =>
                            reviewDoc.mutate({
                              documentId: d.id,
                              status: "approved",
                            })
                          }
                        >
                          <CheckIcon className="size-3.5" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1 gap-1 px-2 text-red-500 hover:text-red-500"
                          onClick={() =>
                            setRejectDoc({ id: d.id, name: d.name })
                          }
                        >
                          <XIcon className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices to review */}
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <SectionTitle icon={ReceiptIcon}>Invoices</SectionTitle>
                <Link
                  href="/admin/invoices"
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-sky-500"
                >
                  View all
                  <ArrowRightIcon className="size-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!invoicesToReview?.length ? (
                <p className="py-6 text-center text-base text-muted-foreground">
                  No invoices yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {invoicesToReview.map((inv) => {
                    const actionable =
                      inv.status === "processing" ||
                      inv.status === "unpaid" ||
                      inv.status === "rejected"
                    return (
                      <div
                        key={inv.id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="truncate text-base font-semibold">
                                ${inv.amount}
                              </p>
                              <span className="font-mono text-xs text-muted-foreground">
                                {formatInvoiceNumber(inv.number)}
                              </span>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              <span className="uppercase">
                                {inv.organization?.name ?? "—"}
                              </span>
                              {inv.owner && (
                                <> · {inv.owner.name ?? inv.owner.email}</>
                              )}
                              {inv.transactionId && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <span className="font-mono">
                                    {inv.transactionId}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <FilingStatusPill status={inv.status} />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 shrink-0 gap-1 px-2"
                              asChild
                            >
                              <Link href="/admin/invoices">
                                <ExternalLinkIcon className="size-3.5" />
                                View
                              </Link>
                            </Button>
                          </div>
                        </div>
                        {actionable && inv.status === "processing" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 gap-1 px-2 text-emerald-500 hover:text-emerald-500"
                              disabled={approveInvoice.isPending}
                              onClick={() =>
                                approveInvoice.mutate({ id: inv.id })
                              }
                            >
                              <CheckIcon className="size-3.5" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 gap-1 px-2 text-red-500 hover:text-red-500"
                              onClick={() =>
                                setRejectInvoice({
                                  id: inv.id,
                                  amount: inv.amount,
                                })
                              }
                            >
                              <XIcon className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent orders */}
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <SectionTitle icon={ShoppingCartIcon}>Orders</SectionTitle>
                <Link
                  href="/admin/orders"
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-sky-500"
                >
                  View all
                  <ArrowRightIcon className="size-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recentOrders?.length ? (
                <p className="py-6 text-center text-base text-muted-foreground">
                  No orders yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrders.map((o) => (
                    <Link
                      key={o.id}
                      href="/admin/orders"
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:opacity-80"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium">
                          {o.service?.title ?? "Service"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          <span className="uppercase">
                            {o.organization?.name ?? "—"}
                          </span>{" "}
                          · {new Date(o.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <FilingStatusPill status={o.status} />
                        <ArrowRightIcon className="size-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent tickets (replaces Pending orders) */}
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base font-semibold">
                <SectionTitle icon={LifeBuoyIcon}>Tickets</SectionTitle>
                <Link
                  href="/admin/tickets"
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-sky-500"
                >
                  View all
                  <ArrowRightIcon className="size-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recentTickets?.length ? (
                <p className="py-6 text-center text-base text-muted-foreground">
                  No tickets yet.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {recentTickets.map((t) => (
                    <Link
                      key={t.id}
                      href={`/admin/tickets/${t.id}`}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:opacity-80"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium">
                          {t.subject}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {t.user?.name ?? t.user?.email ?? "—"}
                          {t.organization && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="uppercase">
                                {t.organization.name}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <PriorityPill priority={t.priority} />
                        <ArrowRightIcon className="size-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 1. Compliance deadline tracker */}
      <Card className="rounded-2xl shadow-none">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base font-semibold">
            <SectionTitle icon={AlertTriangleIcon} iconClass="text-red-500">
              Compliance deadlines
            </SectionTitle>
            <div className="flex flex-wrap gap-1">
              {(["overdue", "d30", "d60", "d90"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBucket(b)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    bucket === b
                      ? bucketStyles[b]
                      : "bg-transparent text-muted-foreground ring-border hover:bg-muted/40"
                  }`}
                >
                  {bucketLabels[b]}
                  <span className="ml-1.5 text-xs opacity-70">
                    {compliance?.counts[b] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bucketItems.length === 0 ? (
            <p className="py-6 text-center text-base text-muted-foreground">
              Nothing in this bucket.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {bucketItems.map((item, i) => (
                <Link
                  key={`${item.orgId}-${item.kind}-${i}`}
                  href={`/admin/formations/${item.orgId}`}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 transition-colors hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">
                      {item.orgName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.kind === "confirmation"
                        ? "Confirmation statement"
                        : "Annual accounts"}
                      {item.country ? ` · ${item.country.toUpperCase()}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p
                        className={`text-base font-semibold ${
                          item.days < 0 || item.days <= 30
                            ? "text-red-500"
                            : ""
                        }`}
                      >
                        {new Date(item.due).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.days < 0
                          ? `${Math.abs(item.days)}d overdue`
                          : `in ${item.days}d`}
                      </p>
                    </div>
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task manager + Recent activity side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
      {/* 6. Task manager */}
      <Card className="rounded-2xl shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <SectionTitle icon={ClipboardListIcon}>Task manager</SectionTitle>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {tasks?.length ?? 0} open
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tasks?.length ? (
            <p className="py-6 text-center text-base text-muted-foreground">
              All caught up — no open tasks.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {tasks.slice(0, 5).map((t) => (
                <Link
                  key={t.id}
                  href={t.href}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{t.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.subtitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                    <PriorityPill priority={t.priority} />
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Recent activity */}
      <Card className="rounded-2xl shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            <SectionTitle icon={CalendarIcon}>Recent activity</SectionTitle>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!activity?.length ? (
            <p className="py-6 text-center text-base text-muted-foreground">
              No recent activity.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {activity.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{a.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="capitalize">{a.subtitle}</span>
                      {a.status ? ` · ${a.status}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {new Date(a.when).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Reject document dialog */}
      <Dialog
        open={!!rejectDoc}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDoc(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject document</DialogTitle>
            <DialogDescription>
              Tell the customer why &quot;{rejectDoc?.name}&quot; was rejected.
              They&apos;ll be asked to re-upload.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDoc(null)
                setRejectReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reviewDoc.isPending}
              onClick={() => {
                if (!rejectDoc) return
                reviewDoc.mutate({
                  documentId: rejectDoc.id,
                  status: "rejected",
                  reason: rejectReason.trim(),
                })
              }}
            >
              Reject document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject invoice dialog */}
      <Dialog
        open={!!rejectInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setRejectInvoice(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
            <DialogDescription>
              Tell the customer why their ${rejectInvoice?.amount} payment
              couldn&apos;t be verified. The invoice will move back to unpaid.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectInvoice(null)
                setRejectReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectInvoiceMut.isPending}
              onClick={() => {
                if (!rejectInvoice) return
                rejectInvoiceMut.mutate({
                  id: rejectInvoice.id,
                  reason: rejectReason.trim(),
                })
              }}
            >
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: typeof Building2Icon
  label: string
  value: number | string
  hint: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group bg-slate-950 px-4 py-3.5 transition-colors hover:bg-slate-900 sm:px-5"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500 transition-colors group-hover:text-sky-400">
        {hint}
      </p>
    </Link>
  )
}
