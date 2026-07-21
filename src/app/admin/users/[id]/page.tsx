"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Building2Icon,
  FileTextIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  LifeBuoyIcon,
  ArrowLeftIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  PencilIcon,
  BanIcon,
  CheckCircleIcon,
  Trash2Icon,
  ArrowRightIcon,
  UserCogIcon,
} from "lucide-react"

type Tab = "companies" | "documents" | "payments" | "orders" | "tickets"

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  unpaid: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  processing: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  rejected: "bg-red-500/15 text-red-500 ring-red-500/25",
  pending: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  completed: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  open: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  closed: "bg-muted text-muted-foreground ring-border",
  submitted: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  approved: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  requested: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
}

function StatusPill({ status }: { status: string }) {
  const cls = statusStyles[status] ?? "bg-muted text-muted-foreground ring-border"
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  )
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"
}

export default function AdminClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: userId } = use(params)
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data, isLoading } = trpc.admin.clientProfile.useQuery({ userId })

  const [tab, setTab] = useState<Tab>("companies")
  const [editOpen, setEditOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  })
  const [suspendReason, setSuspendReason] = useState("")

  const updateClient = trpc.admin.updateClient.useMutation({
    onSuccess: () => {
      utils.admin.clientProfile.invalidate({ userId })
      setEditOpen(false)
      toast.success("Client updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteClient = trpc.admin.deleteClient.useMutation({
    onSuccess: () => {
      toast.success("Client deleted")
      router.push("/admin/users")
    },
    onError: (e) => toast.error(e.message),
  })

  const setSuspended = trpc.admin.setClientSuspended.useMutation({
    onSuccess: (r) => {
      utils.admin.clientProfile.invalidate({ userId })
      setSuspendOpen(false)
      setSuspendReason("")
      toast.success(r.banned ? "Client suspended" : "Client reinstated")
    },
    onError: (e) => toast.error(e.message),
  })

  const promoteFreelancer = trpc.freelancers.promote.useMutation({
    onSuccess: () => {
      toast.success("Turned into a freelancer")
      router.push(`/admin/freelancers/${userId}`)
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-base text-muted-foreground">Client not found.</p>
      </div>
    )
  }

  const { user, companies, documents, invoices, orders, tickets, totals } = data

  const openEdit = () => {
    setEditForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      address: user.address ?? "",
    })
    setEditOpen(true)
  }

  const stats = [
    { label: "Companies", value: totals.companies, icon: Building2Icon },
    { label: "Documents", value: totals.documents, icon: FileTextIcon },
    { label: "Invoices", value: totals.invoices, icon: ReceiptIcon },
    { label: "Orders", value: totals.orders, icon: ShoppingCartIcon },
    { label: "Tickets", value: totals.tickets, icon: LifeBuoyIcon },
    {
      label: "Total paid",
      value: `$${totals.paid.toLocaleString()}`,
      icon: ReceiptIcon,
    },
  ]

  const tabs: { key: Tab; label: string; count: number; icon: typeof Building2Icon }[] = [
    { key: "companies", label: "Companies", count: totals.companies, icon: Building2Icon },
    { key: "documents", label: "Documents", count: totals.documents, icon: FileTextIcon },
    { key: "payments", label: "Invoices", count: totals.invoices, icon: ReceiptIcon },
    { key: "orders", label: "Orders", count: totals.orders, icon: ShoppingCartIcon },
    { key: "tickets", label: "Tickets", count: totals.tickets, icon: LifeBuoyIcon },
  ]

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" onClick={() => router.push("/admin/users")}>
        <ArrowLeftIcon className="size-4" />
        Back to Clients
      </Button>

      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="size-20">
                {user.image && <AvatarImage src={user.image} alt={user.name} />}
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-sky-500 text-2xl font-semibold text-white">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-foreground">
                    {user.name || "—"}
                  </h1>
                  {user.banned && (
                    <Badge variant="destructive">Suspended</Badge>
                  )}
                  {user.role === "admin" && <Badge>Admin</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <MailIcon className="size-4" />
                    {user.email}
                  </span>
                  {user.phone && (
                    <span className="inline-flex items-center gap-2">
                      <PhoneIcon className="size-4" />
                      {user.phone}
                    </span>
                  )}
                  {user.address && (
                    <span className="inline-flex items-center gap-2">
                      <MapPinIcon className="size-4" />
                      {user.address}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="size-4" />
                    Joined{" "}
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {user.banned && user.banReason && (
                  <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
                    Reason: {user.banReason}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={openEdit}>
                <PencilIcon className="size-4" />
                Edit
              </Button>
              {user.role !== "admin" && user.role !== "freelancer" && (
                <Button
                  variant="outline"
                  className="text-sky-500 hover:text-sky-500"
                  onClick={() => promoteFreelancer.mutate({ userId })}
                  disabled={promoteFreelancer.isPending}
                >
                  <UserCogIcon className="size-4" />
                  Make freelancer
                </Button>
              )}
              {user.banned ? (
                <Button
                  variant="outline"
                  className="text-emerald-500 hover:text-emerald-500"
                  onClick={() =>
                    setSuspended.mutate({ userId, suspended: false })
                  }
                  disabled={setSuspended.isPending}
                >
                  <CheckCircleIcon className="size-4" />
                  Reinstate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="text-red-500 hover:text-red-500"
                  onClick={() => setSuspendOpen(true)}
                >
                  <BanIcon className="size-4" />
                  Suspend
                </Button>
              )}
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-600"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border p-4"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10">
              <s.icon className="size-4 text-sky-500" />
            </div>
            <p className="mt-3 text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-base font-medium transition-colors ${
              tab === t.key
                ? "border-sky-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "companies" && (
        <div className="space-y-2">
          {companies.length === 0 ? (
            <EmptyState icon={Building2Icon} message="No companies." />
          ) : (
            companies.map((c) => (
              <Link
                key={c.id}
                href={`/admin/formations/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium uppercase">
                    {c.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.country?.toUpperCase() ?? "—"} · Created{" "}
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill status={c.status} />
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-2">
          {documents.length === 0 ? (
            <EmptyState icon={FileTextIcon} message="No documents." />
          ) : (
            documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.organization?.name} ·{" "}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={d.status} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <EmptyState icon={ReceiptIcon} message="No payments." />
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold">${inv.amount}</p>
                  <p className="text-sm text-muted-foreground">
                    {inv.organization?.name} ·{" "}
                    {new Date(inv.createdAt).toLocaleDateString()}
                    {inv.description ? ` · ${inv.description}` : ""}
                  </p>
                </div>
                <StatusPill status={inv.status} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-2">
          {orders.length === 0 ? (
            <EmptyState icon={ShoppingCartIcon} message="No orders." />
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">
                    Order · {o.serviceId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {o.organization?.name} ·{" "}
                    {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "tickets" && (
        <div className="space-y-2">
          {tickets.length === 0 ? (
            <EmptyState icon={LifeBuoyIcon} message="No tickets." />
          ) : (
            tickets.map((t) => (
              <Link
                key={t.id}
                href={`/admin/tickets/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{t.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.organization?.name ?? "General"} ·{" "}
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill status={t.status} />
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
            <DialogDescription>
              Update name, email, phone, or address for this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">Name</Label>
              <Input
                id="cf-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-email">Email</Label>
              <Input
                id="cf-email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-phone">Phone</Label>
              <Input
                id="cf-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-address">Address</Label>
              <Textarea
                id="cf-address"
                rows={2}
                value={editForm.address}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={updateClient.isPending}
              onClick={() =>
                updateClient.mutate({
                  userId,
                  name: editForm.name.trim() || undefined,
                  email: editForm.email.trim() || undefined,
                  phone: editForm.phone.trim() || null,
                  address: editForm.address.trim() || null,
                })
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend client</DialogTitle>
            <DialogDescription>
              The client won&apos;t be able to sign in until reinstated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="susp-reason">Reason (optional)</Label>
            <Textarea
              id="susp-reason"
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={setSuspended.isPending}
              onClick={() =>
                setSuspended.mutate({
                  userId,
                  suspended: true,
                  reason: suspendReason.trim() || undefined,
                })
              }
            >
              Suspend client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete client permanently</DialogTitle>
            <DialogDescription>
              This will remove <strong>{user.name || user.email}</strong> from
              the app entirely, along with their sessions, tickets, and any
              company they were the sole member of. Companies they share with
              other users are kept (just this membership is removed). This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteClient.isPending}
              onClick={() => deleteClient.mutate({ userId })}
            >
              {deleteClient.isPending ? "Deleting…" : "Delete client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
      <Icon className="size-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
