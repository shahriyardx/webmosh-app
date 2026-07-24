"use client"

import { useEffect, useState } from "react"
import type { inferRouterOutputs } from "@trpc/server"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { AppRouter } from "@/lib/trpc/routers"
import { ServiceOrderStatus } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ShoppingCartIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { formatInvoiceNumber } from "@/lib/invoice-number"

const statusBadge: Record<
  string,
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  awaiting_quote: { label: "Awaiting quote", variant: "destructive" },
}

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

  const [detailsOrder, setDetailsOrder] = useState<OrderRow | null>(null)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage service orders and their status.
        </p>
      </div>

      {orders?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingCartIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-80">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => {
                const sb = statusBadge[order.status] ?? statusBadge.pending
                const isWordpress = order.service?.type === "wordpress"
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{order.service?.title ?? "—"}</span>
                        {isWordpress && (
                          <span className="inline-flex items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500 ring-1 ring-inset ring-sky-500/25">
                            WP
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.invoice?.amount != null
                        ? `$${order.invoice.amount}`
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.invoice?.number != null ? (
                        <a
                          href={`/admin/invoices`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {formatInvoiceNumber(order.invoice.number)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {isWordpress && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDetailsOrder(order)}
                          >
                            View details
                          </Button>
                        )}
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
                        {order.status === ServiceOrderStatus.pending && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: ServiceOrderStatus.processing,
                              })
                            }
                            disabled={updateStatus.isPending}
                          >
                            Mark Processing
                          </Button>
                        )}
                        {order.status === ServiceOrderStatus.processing && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: ServiceOrderStatus.completed,
                              })
                            }
                            disabled={updateStatus.isPending}
                          >
                            Mark Completed
                          </Button>
                        )}
                        {order.status === ServiceOrderStatus.completed && (
                          <span className="text-xs text-green-600">Done</span>
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <WordpressDetailsDialog
        order={detailsOrder}
        onClose={() => setDetailsOrder(null)}
      />

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

function WordpressDetailsDialog({
  order,
  onClose,
}: {
  order: OrderRow | null
  onClose: () => void
}) {
  const creds = (order?.credentials as OrderCredentials | null) ?? null
  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>WordPress order details</DialogTitle>
          <DialogDescription>
            {order?.service?.title ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Design
            </p>
            {order?.customDesignUrl ? (
              <a
                href={order.customDesignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-sky-500 hover:underline"
              >
                {order.customDesignUrl}
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : order?.theme ? (
              <div className="mt-1 flex items-center gap-3">
                {order.theme.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.theme.image}
                    alt={order.theme.title}
                    className="size-16 rounded-md object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{order.theme.title}</p>
                  {order.theme.demoUrl && (
                    <a
                      href={order.theme.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
                    >
                      View demo
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No design specified.
              </p>
            )}
          </div>

          <ContactBlock order={order} />

          <CredsBlock label="cPanel access" section={creds?.cpanel} />
          <CredsBlock label="WP-admin access" section={creds?.wpAdmin} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContactBlock({ order }: { order: OrderRow | null }) {
  const c = order
    ? {
        company: order.contactCompany ?? "",
        address: order.contactAddress ?? "",
        email: order.contactEmail ?? "",
        phone: order.contactPhone ?? "",
      }
    : null
  const hasAny = c && (c.company || c.address || c.email || c.phone)
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Website details
      </p>
      {!hasAny ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Not provided (older order).
        </p>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Company</dt>
            <dd className="text-sm">{c?.company || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="break-all text-sm">{c?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="text-sm">{c?.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Address</dt>
            <dd className="whitespace-pre-wrap text-sm">{c?.address || "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function CredsBlock({
  label,
  section,
}: {
  label: string
  section: CredentialSection | undefined
}) {
  const anyValue =
    !!section && (!!section.url || !!section.username || !!section.password)
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {!anyValue ? (
        <p className="mt-1 text-sm text-muted-foreground">Not provided.</p>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">URL</dt>
            <dd className="break-all font-mono text-xs">
              {section?.url || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Username</dt>
            <dd className="break-all font-mono text-xs">
              {section?.username || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Password</dt>
            <dd className="break-all font-mono text-xs">
              {section?.password || "—"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

const STATUS_OPTIONS: { value: ServiceOrderStatus; label: string }[] = [
  { value: ServiceOrderStatus.pending, label: "Pending" },
  { value: ServiceOrderStatus.processing, label: "Processing" },
  { value: ServiceOrderStatus.completed, label: "Completed" },
  { value: ServiceOrderStatus.awaiting_quote, label: "Awaiting quote" },
]

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
