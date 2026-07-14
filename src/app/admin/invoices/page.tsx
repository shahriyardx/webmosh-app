"use client"

import { useMemo, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { PaymentStatus } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  ReceiptIcon,
  DownloadIcon,
  Trash2Icon,
  PlusIcon,
  XIcon,
  BellIcon,
} from "lucide-react"
import { toast } from "sonner"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { formatInvoiceNumber } from "@/lib/invoice-number"

const tabs = [
  { label: "All", value: undefined },
  { label: "Unpaid", value: PaymentStatus.unpaid },
  { label: "Processing", value: PaymentStatus.processing },
  { label: "Paid", value: PaymentStatus.paid },
] as const

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
}

export default function AdminInvoicesPage() {
  const [status, setStatus] = useState<PaymentStatus | undefined>(undefined)
  const [rejecting, setRejecting] = useState<{ id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const utils = trpc.useUtils()
  const { data: invoices, isLoading } = trpc.invoices.listAll.useQuery({ status })
  const { data: clientOptions } = trpc.admin.clientsWithCompanies.useQuery()
  const approve = trpc.invoices.approve.useMutation({
    onSuccess: () => utils.invoices.listAll.invalidate(),
  })
  const reject = trpc.invoices.reject.useMutation({
    onSuccess: () => {
      utils.invoices.listAll.invalidate()
      setRejecting(null)
      setRejectReason("")
    },
  })
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null)
  const del = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      utils.invoices.listAll.invalidate()
      setDeleteTarget(null)
      toast.success("Invoice deleted")
    },
  })
  const sendReminder = trpc.invoices.sendReminder.useMutation({
    onSuccess: () => toast.success("Reminder email sent"),
    onError: (e) => toast.error(e.message),
  })

  const [createOpen, setCreateOpen] = useState(false)
  const emptyInvoice = {
    mode: "existing" as "existing" | "new",
    userId: "",
    organizationId: "",
    // custom-client fields (mode === "new")
    clientName: "",
    clientEmail: "",
    companyName: "",
    // shared
    description: "",
    items: [{ title: "", amount: "" }] as { title: string; amount: string }[],
  }
  const [newInvoice, setNewInvoice] = useState(emptyInvoice)

  const selectedClient = useMemo(
    () => clientOptions?.find((c) => c.id === newInvoice.userId) ?? null,
    [clientOptions, newInvoice.userId],
  )

  const parsedItems = newInvoice.items
    .map((i) => ({ title: i.title.trim(), amount: Number(i.amount) }))
    .filter((i) => i.title.length > 0 && i.amount > 0)
  const total = parsedItems.reduce((s, i) => s + i.amount, 0)

  const create = trpc.invoices.create.useMutation({
    onSuccess: () => {
      utils.invoices.listAll.invalidate()
      setCreateOpen(false)
      setNewInvoice(emptyInvoice)
      toast.success("Invoice created")
    },
    onError: (e) => toast.error(e.message),
  })
  const createForNewClient = trpc.invoices.createForNewClient.useMutation({
    onSuccess: () => {
      utils.invoices.listAll.invalidate()
      setCreateOpen(false)
      setNewInvoice(emptyInvoice)
      toast.success("Invoice created and client provisioned")
    },
    onError: (e) => toast.error(e.message),
  })

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const canCreate =
    parsedItems.length > 0 &&
    total > 0 &&
    (newInvoice.mode === "existing"
      ? newInvoice.organizationId.length > 0
      : newInvoice.clientName.trim().length > 0 &&
        newInvoice.companyName.trim().length > 0 &&
        isValidEmail(newInvoice.clientEmail)) &&
    !create.isPending &&
    !createForNewClient.isPending

  const updateItem = (idx: number, patch: Partial<{ title: string; amount: string }>) => {
    setNewInvoice((s) => ({
      ...s,
      items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }))
  }
  const addItem = () =>
    setNewInvoice((s) => ({
      ...s,
      items: [...s.items, { title: "", amount: "" }],
    }))
  const removeItem = (idx: number) =>
    setNewInvoice((s) => ({
      ...s,
      items:
        s.items.length === 1
          ? [{ title: "", amount: "" }]
          : s.items.filter((_, i) => i !== idx),
    }))

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all formation invoices.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          New Invoice
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-sky-500/10 text-sky-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {invoices?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ReceiptIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No invoices found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-28">Invoice #</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((inv) => {
                const sb = statusBadge[inv.status] ?? statusBadge.unpaid
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      {formatInvoiceNumber(inv.number)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {inv.organization?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <p>${inv.amount}</p>
                      {inv.description && (
                        <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{inv.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {inv.paymentMethod ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {inv.transactionId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {inv.status === PaymentStatus.processing && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approve.mutate({ id: inv.id })}
                              disabled={approve.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejecting({ id: inv.id })}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {inv.status === PaymentStatus.unpaid && (
                          <span className="text-xs text-muted-foreground">Awaiting payment</span>
                        )}
                        {inv.status === PaymentStatus.paid && (
                          <span className="text-xs text-green-600">Completed</span>
                        )}
                        <Button variant="outline" size="icon" className="size-8" asChild>
                          <a
                            href={`/companies/${inv.organizationId}/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download invoice"
                          >
                            <DownloadIcon className="size-4" />
                          </a>
                        </Button>
                        {inv.status !== PaymentStatus.paid && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            title="Send reminder email"
                            disabled={
                              sendReminder.isPending &&
                              sendReminder.variables?.id === inv.id
                            }
                            onClick={() => sendReminder.mutate({ id: inv.id })}
                          >
                            <BellIcon className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-red-500"
                          title="Delete invoice"
                          onClick={() => setDeleteTarget({ id: inv.id })}
                        >
                          <Trash2Icon className="size-4" />
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

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete invoice"
        description="Delete this invoice? It will be hidden and excluded from revenue. This cannot be undone."
        onConfirm={() => deleteTarget && del.mutate({ id: deleteTarget.id })}
        loading={del.isPending}
      />

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Reject Invoice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide a reason for rejection.
            </p>
            <textarea
              className="mt-4 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-ring"
              rows={3}
              placeholder="e.g. Invalid transaction ID"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejecting(null); setRejectReason("") }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => reject.mutate({ id: rejecting.id, reason: rejectReason })}
                disabled={!rejectReason || reject.isPending}
              >
                {reject.isPending ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create invoice dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
            <DialogDescription>
              Bill a client for one or more services. Optionally override the
              recipient name and email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    setNewInvoice((s) => ({
                      ...s,
                      mode: m,
                      userId: "",
                      organizationId: "",
                      clientName: "",
                      clientEmail: "",
                      companyName: "",
                    }))
                  }
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    newInvoice.mode === m
                      ? "bg-sky-500/10 text-sky-500"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "existing" ? "Existing client" : "New client"}
                </button>
              ))}
            </div>

            {newInvoice.mode === "existing" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-client">Client</Label>
                  <Select
                    value={newInvoice.userId}
                    onValueChange={(v) =>
                      setNewInvoice((s) => ({
                        ...s,
                        userId: v,
                        organizationId: "",
                      }))
                    }
                  >
                    <SelectTrigger id="inv-client" className="w-full">
                      <SelectValue placeholder="Choose a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientOptions ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name || c.email}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.email}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-company">Company</Label>
                  <Select
                    value={newInvoice.organizationId}
                    onValueChange={(v) =>
                      setNewInvoice((s) => ({ ...s, organizationId: v }))
                    }
                    disabled={!selectedClient}
                  >
                    <SelectTrigger id="inv-company" className="w-full">
                      <SelectValue
                        placeholder={
                          selectedClient
                            ? selectedClient.companies.length === 0
                              ? "This client has no companies"
                              : "Choose a company…"
                            : "Select a client first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedClient?.companies ?? []).map((co) => (
                        <SelectItem key={co.id} value={co.id}>
                          {co.name}
                          {co.country && (
                            <span className="ml-2 text-xs uppercase text-muted-foreground">
                              {co.country}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Autofilled, non-editable email */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="inv-email">Recipient email</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    readOnly
                    disabled
                    value={selectedClient?.email ?? ""}
                    placeholder="Auto-filled from selected client"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-client-name">Client name</Label>
                  <Input
                    id="new-client-name"
                    placeholder="Jane Doe"
                    value={newInvoice.clientName}
                    onChange={(e) =>
                      setNewInvoice((s) => ({
                        ...s,
                        clientName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-client-company">Company name</Label>
                  <Input
                    id="new-client-company"
                    placeholder="Acme Ltd"
                    value={newInvoice.companyName}
                    onChange={(e) =>
                      setNewInvoice((s) => ({
                        ...s,
                        companyName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="new-client-email">Client email</Label>
                  <Input
                    id="new-client-email"
                    type="email"
                    placeholder="jane@acme.com"
                    value={newInvoice.clientEmail}
                    onChange={(e) =>
                      setNewInvoice((s) => ({
                        ...s,
                        clientEmail: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    A client account will be created under this email. When
                    they sign in with the matching Google account, the invoice
                    will appear on their dashboard.
                  </p>
                </div>
              </div>
            )}

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <span className="text-xs text-muted-foreground">
                  {parsedItems.length} item{parsedItems.length === 1 ? "" : "s"} · $
                  {total.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2 rounded-lg border border-border p-3">
                {newInvoice.items.map((it, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Input
                      className="flex-1"
                      placeholder={`Service ${idx + 1} (e.g. Annual filing)`}
                      value={it.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                    />
                    <Input
                      className="w-32"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount"
                      value={it.amount}
                      onChange={(e) => updateItem(idx, { amount: e.target.value })}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9 shrink-0 text-muted-foreground hover:text-red-500"
                      onClick={() => removeItem(idx)}
                      title="Remove item"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <PlusIcon className="size-3.5" />
                  Add another service
                </Button>
              </div>
            </div>

            {/* Optional description */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-desc">Notes / description (optional)</Label>
              <Textarea
                id="inv-desc"
                rows={2}
                placeholder="Anything the customer should know…"
                value={newInvoice.description}
                onChange={(e) =>
                  setNewInvoice((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>

          </div>
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-sm font-medium">
              Total: <span className="text-lg font-bold">${total.toFixed(2)}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  if (newInvoice.mode === "existing") {
                    create.mutate({
                      organizationId: newInvoice.organizationId,
                      items: parsedItems,
                      description: newInvoice.description.trim() || undefined,
                    })
                  } else {
                    createForNewClient.mutate({
                      clientName: newInvoice.clientName.trim(),
                      clientEmail: newInvoice.clientEmail.trim(),
                      companyName: newInvoice.companyName.trim(),
                      items: parsedItems,
                      description: newInvoice.description.trim() || undefined,
                    })
                  }
                }}
              >
                {create.isPending || createForNewClient.isPending
                  ? "Creating…"
                  : "Create invoice"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
