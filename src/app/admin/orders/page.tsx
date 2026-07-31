"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { inferRouterOutputs } from "@trpc/server"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { AppRouter } from "@/lib/trpc/routers"
import { ServiceOrderStatus } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { AdminOrderDetails } from "@/components/admin-order-details"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  ShoppingCartIcon,
  PencilIcon,
  Trash2Icon,
  ChevronRightIcon,
  EyeIcon,
  GlobeIcon,
  PackageIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { formatInvoiceNumber } from "@/lib/invoice-number"

type OrderRow = inferRouterOutputs<AppRouter>["serviceOrders"]["listAll"][number]

type CredentialSection = {
  url?: string
  username?: string
  password?: string
}

type OrderCredentials = {
  cpanel?: CredentialSection
  wpAdmin?: CredentialSection
}

export default function AdminOrdersPage() {
  const utils = trpc.useUtils()
  const { data: orders, isLoading } = trpc.serviceOrders.listAll.useQuery()
  const updateStatus = trpc.serviceOrders.updateStatus.useMutation({
    onSuccess: () => utils.serviceOrders.listAll.invalidate(),
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null)
  const [deleteOrder, setDeleteOrder] = useState<OrderRow | null>(null)
  const [alsoDeleteInvoice, setAlsoDeleteInvoice] = useState(false)
  const [quoteOrder, setQuoteOrder] = useState<OrderRow | null>(null)
  const [quoteAmount, setQuoteAmount] = useState("")
  const [quoteDescription, setQuoteDescription] = useState("")

  const remove = trpc.serviceOrders.remove.useMutation({
    onSuccess: () => {
      utils.serviceOrders.listAll.invalidate()
      toast.success("Order deleted")
      setDeleteOrder(null)
      setAlsoDeleteInvoice(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const quote = trpc.serviceOrders.quoteCustomOrder.useMutation({
    onSuccess: () => {
      utils.serviceOrders.listAll.invalidate()
      utils.admin.invoicesToReview.invalidate?.()
      toast.success("Invoice issued")
      setQuoteOrder(null)
      setQuoteAmount("")
      setQuoteDescription("")
    },
    onError: (err) => toast.error(err.message),
  })

  const submitQuote = () => {
    if (!quoteOrder) return
    const amount = parseFloat(quoteAmount)
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    quote.mutate({
      orderId: quoteOrder.id,
      amount,
      description: quoteDescription.trim() || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  const list = orders ?? []
  const q = search.trim().toLowerCase()
  const matchesSearch = (o: OrderRow) =>
    !q ||
    (o.service?.title ?? "").toLowerCase().includes(q) ||
    (o.organization?.name ?? "").toLowerCase().includes(q)

  // Distinct companies for the Company filter.
  const companies = Array.from(
    new Map(
      list
        .map((o) => o.organization)
        .filter((org): org is NonNullable<typeof org> => !!org)
        .map((org) => [org.id, org] as const),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name))

  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null
  const toMs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null

  // Faceted: status counts reflect company + date + search already applied.
  const base = list.filter((o) => {
    if (companyFilter !== "all" && o.organization?.id !== companyFilter)
      return false
    if (!matchesSearch(o)) return false
    const t = new Date(o.createdAt).getTime()
    if (fromMs !== null && t < fromMs) return false
    if (toMs !== null && t > toMs) return false
    return true
  })
  const statusCount = (key: string) =>
    key === "all" ? base.length : base.filter((o) => o.status === key).length
  const filtered =
    statusFilter === "all" ? base : base.filter((o) => o.status === statusFilter)

  const presentStatuses = ORDER_STATUS_META.filter((s) =>
    list.some((o) => o.status === s.key),
  )
  const filtersActive =
    statusFilter !== "all" ||
    companyFilter !== "all" ||
    !!dateFrom ||
    !!dateTo ||
    q.length > 0
  const clearFilters = () => {
    setStatusFilter("all")
    setCompanyFilter("all")
    setDateFrom("")
    setDateTo("")
    setSearch("")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage service orders and their status.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <ShoppingCartIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No orders yet.</p>
        </div>
      ) : (
        <>
          {/* Status filter cards (click to filter; counts are faceted) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FilterCard
              label="Total"
              value={statusCount("all")}
              accent="text-foreground"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            {presentStatuses.map((s) => (
              <FilterCard
                key={s.key}
                label={s.label}
                value={statusCount(s.key)}
                accent={s.accent}
                active={statusFilter === s.key}
                onClick={() => setStatusFilter(s.key)}
              />
            ))}
          </div>

          {/* Always-open filter panel */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Service or company…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company</Label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {companies.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {filtersActive && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <XIcon className="size-3.5" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {list.length} orders
          </p>

          {/* Order cards */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              No orders match your filters.
            </div>
          ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const isWordpress = order.service?.type === "wordpress"
              const expanded = expandedId === order.id
              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-sky-500/30 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:gap-5">
                    {/* Service + company (toggles expand) */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : order.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      title={expanded ? "Collapse" : "Expand order"}
                    >
                      <ChevronRightIcon
                        className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                          expanded ? "rotate-90" : ""
                        }`}
                      />
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
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
                            {order.service?.title ?? "—"}
                          </span>
                          {isWordpress && (
                            <span className="inline-flex shrink-0 items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500 ring-1 ring-inset ring-sky-500/25">
                              WP
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs uppercase tracking-wide text-muted-foreground">
                          {order.organization?.name ?? "—"}
                        </p>
                      </div>
                    </button>

                    {/* Status + amount + invoice */}
                    <div className="flex items-center justify-between gap-4 lg:justify-end lg:gap-5">
                      <Select
                        value={order.status}
                        onValueChange={(v) =>
                          updateStatus.mutate({
                            id: order.id,
                            status: v as ServiceOrderStatus,
                          })
                        }
                      >
                        <SelectTrigger
                          className={`h-8 w-[150px] font-medium ${
                            STATUS_TRIGGER_CLS[order.status] ?? ""
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-right">
                        <div className="text-base font-bold tabular-nums text-foreground">
                          {order.invoice?.amount != null
                            ? `$${order.invoice.amount}`
                            : "—"}
                        </div>
                        {order.invoice?.number != null && (
                          <a
                            href="/admin/invoices"
                            className="font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            {formatInvoiceNumber(order.invoice.number)}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1 lg:shrink-0 lg:justify-end">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/orders/${order.id}`}>
                          <EyeIcon className="size-3.5" />
                          View
                        </Link>
                      </Button>
                      {order.status === ServiceOrderStatus.awaiting_quote && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setQuoteOrder(order)
                            setQuoteAmount("")
                            setQuoteDescription("")
                          }}
                        >
                          Issue quote
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditOrder(order)}
                      >
                        <PencilIcon className="size-3.5" />
                        Modify
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteOrder(order)
                          setAlsoDeleteInvoice(false)
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-border bg-muted/20 p-5">
                      <AdminOrderDetails order={order} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          )}
        </>
      )}

      <Dialog
        open={!!quoteOrder}
        onOpenChange={(open) => !open && setQuoteOrder(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue custom quote</DialogTitle>
            <DialogDescription>
              {quoteOrder?.service?.title} — this creates an unpaid invoice and
              emails the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Amount (USD)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 350.00"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Invoice description (optional)</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-20"
                  placeholder="Defaults to the service title if left empty"
                  value={quoteDescription}
                  onChange={(e) => setQuoteDescription(e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOrder(null)}>
              Cancel
            </Button>
            <Button onClick={submitQuote} disabled={quote.isPending}>
              {quote.isPending ? "Issuing…" : "Issue invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderEditDialog
        order={editOrder}
        onClose={() => setEditOrder(null)}
        onSaved={() => {
          utils.serviceOrders.listAll.invalidate()
          setEditOrder(null)
        }}
      />

      <Dialog
        open={!!deleteOrder}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOrder(null)
            setAlsoDeleteInvoice(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete order</DialogTitle>
            <DialogDescription>
              Delete the order for{" "}
              <span className="font-medium text-foreground">
                {deleteOrder?.service?.title ?? "this service"}
              </span>
              ? This can&apos;t be undone. Any tasks linked to it are kept but
              unlinked.
            </DialogDescription>
          </DialogHeader>
          {deleteOrder?.invoice && (
            <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
              <Checkbox
                checked={alsoDeleteInvoice}
                onCheckedChange={(v) => setAlsoDeleteInvoice(v === true)}
                className="mt-0.5"
              />
              <span>
                Also delete invoice{" "}
                <span className="font-mono">
                  {formatInvoiceNumber(deleteOrder.invoice.number)}
                </span>{" "}
                <span className="text-muted-foreground">
                  (${deleteOrder.invoice.amount})
                </span>
              </span>
            </label>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOrder(null)
                setAlsoDeleteInvoice(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                deleteOrder &&
                remove.mutate({
                  id: deleteOrder.id,
                  deleteInvoice: alsoDeleteInvoice,
                })
              }
            >
              {remove.isPending ? "Deleting…" : "Delete order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Clickable status filter cards (order + colour).
const ORDER_STATUS_META: { key: string; label: string; accent: string }[] = [
  { key: "pending", label: "Pending", accent: "text-amber-600 dark:text-amber-400" },
  { key: "processing", label: "Processing", accent: "text-sky-600 dark:text-sky-400" },
  { key: "completed", label: "Completed", accent: "text-emerald-600 dark:text-emerald-400" },
  { key: "awaiting_quote", label: "Awaiting quote", accent: "text-violet-600 dark:text-violet-400" },
]

function FilterCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string
  value: number
  accent: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:border-sky-500/40 ${
        active ? "border-sky-500 ring-2 ring-sky-500/30" : "border-border"
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </button>
  )
}

const STATUS_OPTIONS: { value: ServiceOrderStatus; label: string }[] = [
  { value: ServiceOrderStatus.pending, label: "Pending" },
  { value: ServiceOrderStatus.processing, label: "Processing" },
  { value: ServiceOrderStatus.completed, label: "Completed" },
  { value: ServiceOrderStatus.awaiting_quote, label: "Awaiting quote" },
]

// Per-status colour for the order status dropdown trigger.
const STATUS_TRIGGER_CLS: Record<string, string> = {
  pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  processing:
    "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  awaiting_quote:
    "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

const EMPTY_CREDS: OrderCredentials = {
  cpanel: { url: "", username: "", password: "" },
  wpAdmin: { url: "", username: "", password: "" },
}

function OrderEditDialog({
  order,
  onClose,
  onSaved,
}: {
  order: OrderRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isWordpress = order?.service?.type === "wordpress"
  const { data: themes } = trpc.themes.list.useQuery(undefined, {
    enabled: !!order && isWordpress,
  })

  const [status, setStatus] = useState<ServiceOrderStatus>(
    ServiceOrderStatus.pending,
  )
  const [amount, setAmount] = useState("")
  const [designMode, setDesignMode] = useState<"theme" | "custom">("theme")
  const [themeId, setThemeId] = useState("")
  const [customDesignUrl, setCustomDesignUrl] = useState("")
  const [contact, setContact] = useState({
    company: "",
    email: "",
    phone: "",
    address: "",
  })
  const [creds, setCreds] = useState<OrderCredentials>(EMPTY_CREDS)
  const requiresRdp = order?.service?.requiresRdp ?? false
  const [rdp, setRdp] = useState({
    host: "",
    username: "",
    password: "",
  })

  useEffect(() => {
    if (!order) return
    setStatus(order.status as ServiceOrderStatus)
    setAmount(order.invoice?.amount != null ? String(order.invoice.amount) : "")
    setDesignMode(order.customDesignUrl ? "custom" : "theme")
    setThemeId(order.themeId ?? "")
    setCustomDesignUrl(order.customDesignUrl ?? "")
    setContact({
      company: order.contactCompany ?? "",
      email: order.contactEmail ?? "",
      phone: order.contactPhone ?? "",
      address: order.contactAddress ?? "",
    })
    const c = (order.credentials as OrderCredentials | null) ?? null
    setCreds({
      cpanel: {
        url: c?.cpanel?.url ?? "",
        username: c?.cpanel?.username ?? "",
        password: c?.cpanel?.password ?? "",
      },
      wpAdmin: {
        url: c?.wpAdmin?.url ?? "",
        username: c?.wpAdmin?.username ?? "",
        password: c?.wpAdmin?.password ?? "",
      },
    })
    setRdp({
      host: order.rdpHost ?? "",
      username: order.rdpUsername ?? "",
      password: order.rdpPassword ?? "",
    })
  }, [order])

  const update = trpc.serviceOrders.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Order updated")
      onSaved()
    },
    onError: (err) => toast.error(err.message),
  })

  const save = () => {
    if (!order) return
    const patch: Parameters<typeof update.mutate>[0] = {
      id: order.id,
      status,
    }
    if (order.invoice) {
      const n = parseFloat(amount)
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Enter a valid amount")
        return
      }
      patch.amount = n
    }
    if (isWordpress) {
      if (designMode === "theme") {
        patch.themeId = themeId || null
        patch.customDesignUrl = null
      } else {
        patch.customDesignUrl = customDesignUrl.trim() || null
        patch.themeId = null
      }
      patch.contactCompany = contact.company.trim() || null
      patch.contactEmail = contact.email.trim() || null
      patch.contactPhone = contact.phone.trim() || null
      patch.contactAddress = contact.address.trim() || null
      patch.credentials = creds
    }
    if (requiresRdp) {
      patch.rdpHost = rdp.host.trim() || null
      patch.rdpUsername = rdp.username.trim() || null
      patch.rdpPassword = rdp.password.trim() || null
    }
    update.mutate(patch)
  }

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modify order</DialogTitle>
          <DialogDescription>{order?.service?.title ?? "—"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <FieldContent>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ServiceOrderStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            {order?.invoice && (
              <Field>
                <FieldLabel>Invoice amount (USD)</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </FieldContent>
              </Field>
            )}
          </div>

          {requiresRdp && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold">RDP access</p>
                <p className="text-xs text-muted-foreground">
                  Shared with the customer on their company page.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Host / IP address"
                  value={rdp.host}
                  onChange={(e) => setRdp({ ...rdp, host: e.target.value })}
                />
                <Input
                  placeholder="Username"
                  value={rdp.username}
                  onChange={(e) => setRdp({ ...rdp, username: e.target.value })}
                />
                <Input
                  placeholder="Password"
                  value={rdp.password}
                  onChange={(e) => setRdp({ ...rdp, password: e.target.value })}
                />
              </div>
            </div>
          )}

          {isWordpress && (
            <>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDesignMode("theme")}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      designMode === "theme"
                        ? "border-sky-500 bg-sky-500/5 font-medium"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    Demo theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setDesignMode("custom")}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      designMode === "custom"
                        ? "border-sky-500 bg-sky-500/5 font-medium"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    Custom design
                  </button>
                </div>
                {designMode === "theme" ? (
                  <Select
                    value={themeId || "none"}
                    onValueChange={(v) => setThemeId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No theme</SelectItem>
                      {(themes ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="https://figma.com/… or design URL"
                    value={customDesignUrl}
                    onChange={(e) => setCustomDesignUrl(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Website details
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Company"
                    value={contact.company}
                    onChange={(e) =>
                      setContact({ ...contact, company: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Email"
                    value={contact.email}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Phone"
                    value={contact.phone}
                    onChange={(e) =>
                      setContact({ ...contact, phone: e.target.value })
                    }
                  />
                  <Input
                    placeholder="Address"
                    value={contact.address}
                    onChange={(e) =>
                      setContact({ ...contact, address: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Hosting access
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="cPanel URL"
                    value={creds.cpanel?.url ?? ""}
                    onChange={(e) =>
                      setCreds({
                        ...creds,
                        cpanel: { ...creds.cpanel, url: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="cPanel user"
                    value={creds.cpanel?.username ?? ""}
                    onChange={(e) =>
                      setCreds({
                        ...creds,
                        cpanel: { ...creds.cpanel, username: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="cPanel pass"
                    value={creds.cpanel?.password ?? ""}
                    onChange={(e) =>
                      setCreds({
                        ...creds,
                        cpanel: { ...creds.cpanel, password: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="wp-admin URL"
                    value={creds.wpAdmin?.url ?? ""}
                    onChange={(e) =>
                      setCreds({
                        ...creds,
                        wpAdmin: { ...creds.wpAdmin, url: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="wp-admin user"
                    value={creds.wpAdmin?.username ?? ""}
                    onChange={(e) =>
                      setCreds({
                        ...creds,
                        wpAdmin: { ...creds.wpAdmin, username: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="wp-admin pass"
                    value={creds.wpAdmin?.password ?? ""}
                    onChange={(e) =>
                      setCreds({
                        ...creds,
                        wpAdmin: { ...creds.wpAdmin, password: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
