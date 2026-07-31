"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ClipboardListIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CalendarIcon,
} from "lucide-react"

type AdminTask = {
  id: string
  title: string
  note: string | null
  priority: string
  done: boolean
  dueDate: Date | string | null
}

const PRIORITY: Record<string, { label: string; cls: string }> = {
  low: {
    label: "Low",
    cls: "bg-muted text-muted-foreground ring-border",
  },
  medium: {
    label: "Medium",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  high: {
    label: "High",
    cls: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  },
}

const toDateInput = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : ""

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString() : null

export function AdminTaskManager() {
  const utils = trpc.useUtils()
  const { data: tasks } = trpc.adminTasks.list.useQuery()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AdminTask | null>(null)
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")

  const invalidate = () => utils.adminTasks.list.invalidate()
  const create = trpc.adminTasks.create.useMutation({
    onSuccess: () => {
      invalidate()
      closeDialog()
      toast.success("Task added")
    },
    onError: (e) => toast.error(e.message),
  })
  const update = trpc.adminTasks.update.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  })
  const remove = trpc.adminTasks.delete.useMutation({
    onSuccess: () => {
      invalidate()
      closeDialog()
      toast.success("Task deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const openCreate = () => {
    setEditing(null)
    setTitle("")
    setNote("")
    setPriority("medium")
    setDueDate("")
    setOpen(true)
  }
  const openEdit = (t: AdminTask) => {
    setEditing(t)
    setTitle(t.title)
    setNote(t.note ?? "")
    setPriority(t.priority)
    setDueDate(toDateInput(t.dueDate))
    setOpen(true)
  }
  const closeDialog = () => {
    setOpen(false)
    setEditing(null)
  }

  const save = () => {
    if (!title.trim()) {
      toast.error("Title is required.")
      return
    }
    const payload = {
      title: title.trim(),
      note: note.trim() || undefined,
      priority: priority as "low" | "medium" | "high",
      dueDate: dueDate || undefined,
    }
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          ...payload,
          note: note.trim() || null,
          dueDate: dueDate || null,
        },
        {
          onSuccess: () => {
            closeDialog()
            toast.success("Task updated")
          },
        },
      )
    } else {
      create.mutate(payload)
    }
  }

  const list = tasks ?? []
  const openCount = list.filter((t) => !t.done).length
  const saving = create.isPending || update.isPending

  return (
    <>
      <Card className="rounded-2xl shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2">
              <ClipboardListIcon className="size-4 text-sky-500" />
              Task manager
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {openCount} open
              </span>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="py-6 text-center text-base text-muted-foreground">
              No tasks yet — add one to get started.
            </p>
          ) : (
            <div className="max-h-80 divide-y divide-border overflow-y-auto">
              {list.map((t) => {
                const p = PRIORITY[t.priority] ?? PRIORITY.medium
                const due = fmtDate(t.dueDate)
                return (
                  <div
                    key={t.id}
                    className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <Checkbox
                      checked={t.done}
                      onCheckedChange={(v) =>
                        update.mutate({ id: t.id, done: v === true })
                      }
                      aria-label="Toggle done"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          t.done
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.note && (
                        <p className="truncate text-xs text-muted-foreground">
                          {t.note}
                        </p>
                      )}
                    </div>
                    {due && (
                      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                        <CalendarIcon className="size-3" />
                        {due}
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${p.cls}`}
                    >
                      {p.label}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(t)}
                      title="Edit task"
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "Add task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="What needs doing?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                className="min-h-20"
                placeholder="Optional details…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {editing ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: editing.id })}
              >
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save" : "Add task"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
