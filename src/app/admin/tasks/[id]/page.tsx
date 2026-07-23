"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { TaskDetailsPanel } from "@/components/task-details-panel"
import { NoteView } from "@/components/note-editor"
import {
  ArrowLeftIcon,
  CheckIcon,
  RotateCcwIcon,
  XCircleIcon,
  PencilIcon,
  Trash2Icon,
  NotebookPenIcon,
} from "lucide-react"

const STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "bg-muted text-muted-foreground ring-border" },
  in_progress: {
    label: "In progress",
    cls: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  },
  in_review: {
    label: "Pending approval",
    cls: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  },
  blocked: { label: "Blocked", cls: "bg-red-500/15 text-red-500 ring-red-500/25" },
  done: {
    label: "Approved",
    cls: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  },
}

type EditForm = {
  title: string
  description: string
  priority: TaskPriority
  deadline: string
  payout: string
}

function toDateInput(d: Date | string | null | undefined) {
  if (!d) return ""
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ""
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

export default function AdminTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id })

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<EditForm>({
    title: "",
    description: "",
    priority: TaskPriority.medium,
    deadline: "",
    payout: "",
  })
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionNote, setRevisionNote] = useState("")
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description,
        priority: task.priority,
        deadline: toDateInput(task.deadline),
        payout: task.payoutAmount != null ? String(task.payoutAmount) : "",
      })
    }
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    utils.tasks.getById.invalidate({ id })
    utils.tasks.pendingApprovals.invalidate()
    utils.tasks.pendingApprovalCount.invalidate()
    utils.tasks.wordpressOrdersQueue.invalidate()
    utils.tasks.listAll.invalidate()
    utils.freelancers.list.invalidate()
  }

  const approve = trpc.tasks.approveTask.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Task approved — payment released")
    },
    onError: (e) => toast.error(e.message),
  })
  const requestRevision = trpc.tasks.requestRevision.useMutation({
    onSuccess: () => {
      invalidate()
      setRevisionOpen(false)
      setRevisionNote("")
      toast.success("Sent back for revision")
    },
    onError: (e) => toast.error(e.message),
  })
  const reject = trpc.tasks.rejectTask.useMutation({
    onSuccess: () => {
      invalidate()
      setRejectOpen(false)
      setRejectNote("")
      toast.success("Task rejected")
    },
    onError: (e) => toast.error(e.message),
  })
  const update = trpc.tasks.update.useMutation({
    onSuccess: () => {
      invalidate()
      setEditOpen(false)
      toast.success("Task updated")
    },
    onError: (e) => toast.error(e.message),
  })
  const del = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted")
      router.push("/admin/freelancers")
    },
    onError: (e) => toast.error(e.message),
  })

  const submitEdit = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required.")
      return
    }
    const payout = form.payout.trim() ? parseFloat(form.payout) : null
    if (payout !== null && (isNaN(payout) || payout < 0)) {
      toast.error("Enter a valid payment amount.")
      return
    }
    update.mutate({
      id,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      deadline: form.deadline ? new Date(form.deadline) : null,
      payoutAmount: payout,
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }
  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    )
  }

  const st = STATUS[task.status]
  const inReview = task.status === "in_review"

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/freelancers">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground">
            {task.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {task.assignedTo?.name ?? "Unassigned"}
            {task.organization?.name ? ` · ${task.organization.name}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${st.cls}`}
        >
          {st.label}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Details */}
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <TaskDetailsPanel taskId={id} />
          </Card>

          {task.deliveryNote && (
            <Card>
              <CardContent className="space-y-2 p-6">
                <div className="flex items-center gap-2">
                  <NotebookPenIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Delivery note{" "}
                    {task.deliveryNoteIncluded ? (
                      <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
                        shared
                      </span>
                    ) : (
                      <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        not shared
                      </span>
                    )}
                  </h2>
                </div>
                <NoteView text={task.deliveryNote} className="text-muted-foreground" />
              </CardContent>
            </Card>
          )}

          {task.revisionNote && (
            <Card className="border-orange-500/30">
              <CardContent className="space-y-1.5 p-6">
                <div className="flex items-center gap-2 text-orange-500">
                  <RotateCcwIcon className="size-4" />
                  <h2 className="text-sm font-semibold">Revision / rejection note</h2>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {task.revisionNote}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </h2>

              {inReview ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    This task is awaiting your approval.
                  </p>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-600/90"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ id })}
                  >
                    <CheckIcon className="size-4" />
                    Approve &amp; release payment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-orange-500 hover:text-orange-500"
                    onClick={() => setRevisionOpen(true)}
                  >
                    <RotateCcwIcon className="size-4" />
                    Request revision
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-500 hover:text-red-500"
                    onClick={() => setRejectOpen(true)}
                  >
                    <XCircleIcon className="size-4" />
                    Reject
                  </Button>
                  <div className="my-1 h-px bg-border" />
                </>
              ) : null}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon className="size-4" />
                Edit task / add changes
              </Button>
              <Button
                variant="outline"
                className="w-full text-red-500 hover:text-red-500"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Delete task
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2.5 p-5 text-sm">
              <Row label="Priority" value={cap(task.priority)} />
              <Row
                label="Payment"
                value={
                  task.payoutAmount != null
                    ? `$${task.payoutAmount.toFixed(2)}`
                    : "Unpaid"
                }
              />
              <Row
                label="Deadline"
                value={
                  task.deadline
                    ? new Date(task.deadline).toLocaleDateString()
                    : "None"
                }
              />
              {task.order?.service && (
                <Row label="Service" value={task.order.service.title} />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update the task or add extra changes for the freelancer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldContent>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-28"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
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
                <FieldLabel>Deadline</FieldLabel>
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
              <FieldLabel>Payment (USD)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.payout}
                  onChange={(e) => setForm({ ...form, payout: e.target.value })}
                  placeholder="Leave empty for unpaid"
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision dialog */}
      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request revision</DialogTitle>
            <DialogDescription>
              Send the task back to the freelancer with a note on what to fix.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="What needs to change…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!revisionNote.trim() || requestRevision.isPending}
              onClick={() =>
                requestRevision.mutate({ id, note: revisionNote.trim() })
              }
            >
              {requestRevision.isPending ? "Sending…" : "Send for revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject task</DialogTitle>
            <DialogDescription>
              The task is marked blocked and no payment is released. Give the
              freelancer a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Why is this being rejected…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectNote.trim() || reject.isPending}
              onClick={() => reject.mutate({ id, note: rejectNote.trim() })}
            >
              {reject.isPending ? "Rejecting…" : "Reject task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task"
        description="This permanently deletes the task. This cannot be undone."
        onConfirm={() => del.mutate({ id })}
        loading={del.isPending}
      />
    </div>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}
