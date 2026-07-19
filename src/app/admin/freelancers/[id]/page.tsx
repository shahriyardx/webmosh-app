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
    </div>
  )
}
