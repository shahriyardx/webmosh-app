"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
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
  ArrowLeftIcon,
  PlusIcon,
  ClipboardListIcon,
  Trash2Icon,
  WalletIcon,
  SlidersHorizontalIcon,
  RotateCcwIcon,
  MinusIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
} from "lucide-react"

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  high: "bg-red-500/15 text-red-500 ring-red-500/25",
}

const statusStyles: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground ring-border",
  in_progress: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  in_review: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  blocked: "bg-red-500/15 text-red-500 ring-red-500/25",
  done: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "Pending approval",
  blocked: "Blocked",
  done: "Approved",
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

type FormState = {
  title: string
  description: string
  priority: TaskPriority
  deadline: string
  payout: string
  organizationId: string
  orderId: string
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  priority: TaskPriority.medium,
  deadline: "",
  payout: "",
  organizationId: "",
  orderId: "",
}

export default function FreelancerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const utils = trpc.useUtils()

  const { data: freelancer, isLoading } = trpc.freelancers.getById.useQuery({ id })
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.listAll.useQuery({
    assignedToId: id,
  })
  const { data: orgs } = trpc.admin.clientsWithCompanies.useQuery()
  const { data: allOrders } = trpc.serviceOrders.listAll.useQuery()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)

  const { data: balance } = trpc.payouts.adminBalance.useQuery({
    freelancerId: id,
  })
  const { data: transactions } = trpc.payouts.adminTransactions.useQuery({
    freelancerId: id,
  })
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustDir, setAdjustDir] = useState<"add" | "remove">("add")
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [resetOpen, setResetOpen] = useState(false)

  const resetAdjust = () => {
    setAdjustDir("add")
    setAdjustAmount("")
    setAdjustNote("")
  }

  const adjustBalance = trpc.payouts.adjustBalance.useMutation({
    onSuccess: () => {
      utils.payouts.adminBalance.invalidate({ freelancerId: id })
      utils.payouts.adminTransactions.invalidate({ freelancerId: id })
      utils.freelancers.list.invalidate()
      toast.success("Balance updated")
      setAdjustOpen(false)
      resetAdjust()
    },
    onError: (e) => toast.error(e.message),
  })

  const resetHistory = trpc.payouts.resetHistory.useMutation({
    onSuccess: (r) => {
      utils.payouts.adminBalance.invalidate({ freelancerId: id })
      utils.payouts.adminTransactions.invalidate({ freelancerId: id })
      utils.freelancers.list.invalidate()
      toast.success(`Payout history reset (${r.deleted} removed)`)
      setResetOpen(false)
    },
    onError: (e) => toast.error(e.message),
  })

  const submitAdjust = () => {
    const amt = parseFloat(adjustAmount)
    if (!amt || amt <= 0) {
      toast.error("Enter an amount greater than 0.")
      return
    }
    if (adjustDir === "remove" && amt > (balance?.available ?? 0)) {
      toast.error(
        `Can't remove more than the available balance ($${(balance?.available ?? 0).toFixed(2)}).`,
      )
      return
    }
    adjustBalance.mutate({
      freelancerId: id,
      direction: adjustDir,
      amount: amt,
      note: adjustNote.trim() || undefined,
    })
  }

  const orgOptions = useMemo(() => {
    const all: { id: string; name: string }[] = []
    for (const client of orgs ?? []) {
      for (const c of client.companies) {
        if (c) all.push({ id: c.id, name: c.name })
      }
    }
    return all
  }, [orgs])

  const orderOptions = useMemo(() => {
    return (allOrders ?? []).map((o) => ({
      id: o.id,
      label: `${o.service?.title ?? "Order"} — ${o.id.slice(0, 8)}`,
    }))
  }, [allOrders])

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate()
      utils.freelancers.list.invalidate()
      toast.success("Task assigned")
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.listAll.invalidate()
      utils.freelancers.list.invalidate()
      setDeleteTaskId(null)
      toast.success("Task deleted")
    },
    onError: (err) => toast.error(err.message),
  })

  const submit = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required")
      return
    }
    const payoutAmount = form.payout.trim() ? parseFloat(form.payout) : null
    if (payoutAmount !== null && (Number.isNaN(payoutAmount) || payoutAmount < 0)) {
      toast.error("Please enter a valid payment amount")
      return
    }
    createTask.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      deadline: form.deadline ? new Date(form.deadline) : null,
      payoutAmount,
      assignedToId: id,
      organizationId: form.organizationId || null,
      orderId: form.orderId || null,
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!freelancer) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Freelancer not found.</p>
      </div>
    )
  }

  const initials = freelancer.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/freelancers">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={freelancer.image ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{freelancer.name}</h1>
            <p className="text-sm text-muted-foreground">
              {freelancer.email}
              {freelancer.phone ? ` · ${freelancer.phone}` : ""}
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setDialogOpen(true)}>
            <PlusIcon className="mr-1.5 size-4" />
            Assign task
          </Button>
        </div>
      </div>

      {/* Balance */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <WalletIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Balance</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetAdjust()
                setAdjustOpen(true)
              }}
            >
              <SlidersHorizontalIcon className="size-3.5" />
              Adjust balance
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcwIcon className="size-3.5" />
              Reset payout history
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          <BalanceStat
            label="Available"
            value={balance?.available ?? 0}
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <BalanceStat label="Earned" value={balance?.earned ?? 0} />
          <BalanceStat
            label="Adjustments"
            value={balance?.adjustments ?? 0}
            signed
          />
          <BalanceStat label="Paid out" value={balance?.paidOut ?? 0} />
          <BalanceStat label="Pending" value={balance?.requested ?? 0} />
        </div>

        {/* Recent transactions */}
        <div className="border-t border-border">
          <p className="px-5 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent transactions
          </p>
          {!transactions?.length ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <div className="max-h-[26rem] divide-y divide-border overflow-y-auto">
              {transactions.map((tx) => {
                const credit = tx.amount >= 0
                const kindLabel =
                  tx.kind === "task"
                    ? "Task payment"
                    : tx.kind === "adjustment"
                      ? credit
                        ? "Addition"
                        : "Deduction"
                      : "Payout"
                const Icon =
                  tx.kind === "payout"
                    ? ArrowUpRightIcon
                    : credit
                      ? ArrowDownLeftIcon
                      : MinusIcon
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                          credit
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {kindLabel} ·{" "}
                          {new Date(tx.date).toLocaleDateString()}
                          {tx.status === "pending" && (
                            <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                              Pending
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        credit
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {credit ? "+" : "−"}${Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {tasksLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
          </CardContent>
        </Card>
      ) : !tasks?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ClipboardListIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tasks assigned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Linked</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <Pill className={priorityStyles[t.priority]}>
                      {t.priority}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <Pill className={statusStyles[t.status]}>
                      {statusLabels[t.status]}
                    </Pill>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.deadline
                      ? new Date(t.deadline).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.payoutAmount != null ? (
                      <span
                        className={
                          t.status === "done"
                            ? "font-semibold text-emerald-500"
                            : ""
                        }
                      >
                        ${t.payoutAmount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.organization?.name ?? t.order?.service?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-red-500"
                      onClick={() => setDeleteTaskId(t.id)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign new task</DialogTitle>
            <DialogDescription>
              {freelancer.name} will see this in their freelancer dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldContent>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Design homepage for Acme LLC"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="min-h-24"
                  placeholder="What needs to be done, deliverables, any notes…"
                />
              </FieldContent>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Priority</FieldLabel>
                <FieldContent>
                  <Select
                    value={form.priority}
                    onValueChange={(v) =>
                      setForm({ ...form, priority: v as TaskPriority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Deadline (optional)</FieldLabel>
                <FieldContent>
                  <Input
                    type="date"
                    value={form.deadline}
                    onChange={(e) =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                </FieldContent>
              </Field>
            </div>
            <Field>
              <FieldLabel>Job payment (USD)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 150.00"
                  value={form.payout}
                  onChange={(e) => setForm({ ...form, payout: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Added to the freelancer's balance when they mark the task
                  done. Leave empty for unpaid.
                </p>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Link to a company (optional)</FieldLabel>
              <FieldContent>
                <Select
                  value={form.organizationId || "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      organizationId: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No company</SelectItem>
                    {orgOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Link to a service order (optional)</FieldLabel>
              <FieldContent>
                <Select
                  value={form.orderId || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, orderId: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No order</SelectItem>
                    {orderOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Linking an order lets the freelancer see the theme, custom
                  design URL and hosting credentials the customer submitted.
                </p>
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createTask.isPending}>
              {createTask.isPending ? "Assigning…" : "Assign task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTaskId}
        onOpenChange={(open) => !open && setDeleteTaskId(null)}
        title="Delete task"
        description="This action cannot be undone."
        onConfirm={() => deleteTaskId && deleteTask.mutate({ id: deleteTaskId })}
        loading={deleteTask.isPending}
      />

      {/* Adjust balance */}
      <Dialog
        open={adjustOpen}
        onOpenChange={(o) => {
          if (!o) {
            resetAdjust()
            setAdjustOpen(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              {freelancer.name} · current available{" "}
              <span className="font-semibold text-foreground">
                ${(balance?.available ?? 0).toFixed(2)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustDir("add")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition-colors ${
                  adjustDir === "add"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <PlusIcon className="size-4" />
                Add funds
              </button>
              <button
                type="button"
                onClick={() => setAdjustDir("remove")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition-colors ${
                  adjustDir === "remove"
                    ? "border-red-500/50 bg-red-500/10 text-red-600"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <MinusIcon className="size-4" />
                Remove funds
              </button>
            </div>
            <Field>
              <FieldLabel>Amount (USD)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 50.00"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Reason / note (optional)</FieldLabel>
              <FieldContent>
                <Textarea
                  rows={2}
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Why is this adjustment being made?"
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant={adjustDir === "add" ? "default" : "destructive"}
              className="w-full"
              disabled={adjustBalance.isPending}
              onClick={submitAdjust}
            >
              {adjustBalance.isPending
                ? "Working…"
                : adjustDir === "add"
                  ? "Add to balance"
                  : "Remove from balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset payout history */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset payout history?</DialogTitle>
            <DialogDescription>
              This permanently deletes all of {freelancer.name}&apos;s payout
              records (pending, approved and rejected). Their earnings and
              manual adjustments are kept, so the available balance returns to
              earned + adjustments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={resetHistory.isPending}
              onClick={() => resetHistory.mutate({ freelancerId: id })}
            >
              {resetHistory.isPending ? "Resetting…" : "Reset history"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BalanceStat({
  label,
  value,
  valueClass,
  signed,
}: {
  label: string
  value: number
  valueClass?: string
  signed?: boolean
}) {
  const display = signed && value !== 0
    ? `${value > 0 ? "+" : "−"}$${Math.abs(value).toFixed(2)}`
    : `$${value.toFixed(2)}`
  return (
    <div className="bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums text-foreground ${valueClass ?? ""}`}
      >
        {display}
      </p>
    </div>
  )
}
