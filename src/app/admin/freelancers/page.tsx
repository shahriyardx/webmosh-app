"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  MailPlusIcon,
  UserCogIcon,
  ExternalLinkIcon,
  Trash2Icon,
  XIcon,
  Code2Icon,
  ClipboardCheckIcon,
  CheckIcon,
  RotateCcwIcon,
} from "lucide-react"
import { TaskPriority } from "@/generated/prisma/enums"

type FreelancerRow = {
  id: string
  name: string
  email: string
}

type AssignTarget = {
  orderId: string
  serviceTitle: string
  orgName: string
}

export default function AdminFreelancersPage() {
  const utils = trpc.useUtils()
  const { data: freelancers, isLoading } = trpc.freelancers.list.useQuery()
  const { data: invites } = trpc.freelancers.listInvites.useQuery()
  const { data: wpQueue } = trpc.tasks.wordpressOrdersQueue.useQuery()
  const { data: pendingApprovals } = trpc.tasks.pendingApprovals.useQuery()

  const [revisionTarget, setRevisionTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const [revisionNote, setRevisionNote] = useState("")

  const invalidateApprovals = () => {
    utils.tasks.pendingApprovals.invalidate()
    utils.tasks.listAll.invalidate()
    utils.freelancers.list.invalidate()
  }

  const approveTask = trpc.tasks.approveTask.useMutation({
    onSuccess: () => {
      invalidateApprovals()
      toast.success("Task approved — payment added to the freelancer")
    },
    onError: (err) => toast.error(err.message),
  })

  const requestRevision = trpc.tasks.requestRevision.useMutation({
    onSuccess: () => {
      invalidateApprovals()
      setRevisionTarget(null)
      setRevisionNote("")
      toast.success("Sent back for revision")
    },
    onError: (err) => toast.error(err.message),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<FreelancerRow | null>(null)

  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null)
  const defaultDescription = (orgName: string) =>
    `Build the WordPress site for ${orgName}. Theme, custom design URL and hosting credentials are on the task page.`

  const [assignForm, setAssignForm] = useState({
    freelancerId: "",
    priority: TaskPriority.medium as TaskPriority,
    deadline: "",
    description: "",
    payout: "",
  })

  const assignTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.wordpressOrdersQueue.invalidate()
      utils.tasks.listAll.invalidate()
      utils.freelancers.list.invalidate()
      toast.success("Assigned to freelancer")
      setAssignTarget(null)
      setAssignForm({
        freelancerId: "",
        priority: TaskPriority.medium,
        deadline: "",
        description: "",
        payout: "",
      })
    },
    onError: (err) => toast.error(err.message),
  })

  const openAssign = (target: AssignTarget) => {
    setAssignTarget(target)
    setAssignForm({
      freelancerId: "",
      priority: TaskPriority.medium,
      deadline: "",
      description: defaultDescription(target.orgName),
      payout: "",
    })
  }

  const submitAssign = () => {
    if (!assignTarget || !assignForm.freelancerId) {
      toast.error("Please pick a freelancer")
      return
    }
    if (!assignForm.description.trim()) {
      toast.error("Please provide a description for the freelancer")
      return
    }
    const payoutAmount = assignForm.payout.trim()
      ? parseFloat(assignForm.payout)
      : null
    if (payoutAmount !== null && (Number.isNaN(payoutAmount) || payoutAmount < 0)) {
      toast.error("Please enter a valid payment amount")
      return
    }
    assignTask.mutate({
      title: `${assignTarget.serviceTitle} — ${assignTarget.orgName}`,
      description: assignForm.description.trim(),
      priority: assignForm.priority,
      deadline: assignForm.deadline ? new Date(assignForm.deadline) : null,
      payoutAmount,
      assignedToId: assignForm.freelancerId,
      orderId: assignTarget.orderId,
    })
  }

  const invite = trpc.freelancers.invite.useMutation({
    onSuccess: (data) => {
      utils.freelancers.listInvites.invalidate()
      toast.success(
        data.alreadyRegistered
          ? "Invite sent — they'll be upgraded on their next sign-in."
          : "Invite sent — they'll join as a freelancer after signing in with Google.",
      )
      setInviteEmail("")
      setDialogOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const revokeInvite = trpc.freelancers.revokeInvite.useMutation({
    onSuccess: () => {
      utils.freelancers.listInvites.invalidate()
      toast.success("Invitation revoked")
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteFreelancer = trpc.freelancers.delete.useMutation({
    onSuccess: () => {
      utils.freelancers.list.invalidate()
      setDeleteTarget(null)
      toast.success("Freelancer removed")
    },
    onError: (err) => toast.error(err.message),
  })

  const submit = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) {
      toast.error("Enter an email address")
      return
    }
    invite.mutate({ email })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Freelancers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite freelancers by email. They sign in with Google — no password
            required.
          </p>
        </div>
        <Button
          onClick={() => {
            setInviteEmail("")
            setDialogOpen(true)
          }}
        >
          <MailPlusIcon className="mr-1.5 size-4" />
          Invite freelancer
        </Button>
      </div>

      {invites && invites.length > 0 && (
        <div className="rounded-lg border border-dashed border-border">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Pending invites</p>
            <p className="text-xs text-muted-foreground">
              They'll join automatically the first time they sign in with
              Google using this email.
            </p>
          </div>
          <Table>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    Invited by {inv.invitedBy?.name ?? "—"} ·{" "}
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="w-16">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-red-500"
                      onClick={() => revokeInvite.mutate({ id: inv.id })}
                      title="Revoke invite"
                      disabled={revokeInvite.isPending}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {wpQueue && wpQueue.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Code2Icon className="size-4 text-sky-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Web development queue</p>
              <p className="text-xs text-muted-foreground">
                WordPress orders. Assign each one to a freelancer to get work
                started.
              </p>
            </div>
            <span className="inline-flex items-center rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-500">
              {wpQueue.filter((o) => !o.task).length} unassigned
            </span>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Design</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {wpQueue.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium uppercase">
                    {o.organization?.name ?? "—"}
                  </TableCell>
                  <TableCell>{o.service?.title ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.theme?.title
                      ? `Demo: ${o.theme.title}`
                      : o.customDesignUrl
                      ? "Custom design"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {o.task?.assignedTo ? (
                      <span className="text-sm">
                        {o.task.assignedTo.name}
                        {o.task.status === "done" && (
                          <span className="ml-1.5 text-xs text-emerald-500">
                            · done
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!o.task ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          openAssign({
                            orderId: o.id,
                            serviceTitle: o.service?.title ?? "WordPress",
                            orgName: o.organization?.name ?? "customer",
                          })
                        }
                      >
                        Assign
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/freelancers/${o.task.assignedTo?.id ?? ""}`}>
                          View
                          <ExternalLinkIcon className="ml-1 size-3" />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 border-b border-amber-500/20 px-4 py-3">
            <ClipboardCheckIcon className="size-4 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Awaiting your approval</p>
              <p className="text-xs text-muted-foreground">
                Freelancers marked these tasks done. Review and approve to
                release payment, or send back for revision.
              </p>
            </div>
            <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">
              {pendingApprovals.length} pending
            </span>
          </div>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Freelancer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingApprovals.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.organization?.name ??
                        t.order?.service?.title ??
                        "Standalone task"}
                      {t.revisionNote ? " · resubmitted" : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.assignedTo?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {t.payoutAmount != null
                      ? `$${t.payoutAmount.toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.submittedAt
                      ? new Date(t.submittedAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-500 hover:text-orange-500"
                        onClick={() =>
                          setRevisionTarget({ id: t.id, title: t.title })
                        }
                      >
                        <RotateCcwIcon className="size-3.5" />
                        Revision
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-600/90"
                        disabled={approveTask.isPending}
                        onClick={() => approveTask.mutate({ id: t.id })}
                      >
                        <CheckIcon className="size-3.5" />
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!freelancers?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <UserCogIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No freelancers yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Open tasks</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {freelancers.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.email}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-500">
                      {f.tasks.open}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-500">
                      {f.tasks.done}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/freelancers/${f.id}`}>
                          Open
                          <ExternalLinkIcon className="ml-1 size-3" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 text-red-500"
                        onClick={() =>
                          setDeleteTarget({
                            id: f.id,
                            name: f.name,
                            email: f.email,
                          })
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite freelancer</DialogTitle>
            <DialogDescription>
              We'll email them a link. When they sign in with Google using
              this email address, their freelancer account is created
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Email</FieldLabel>
              <FieldContent>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="freelancer@example.com"
                  autoFocus
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={invite.isPending}>
              {invite.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!assignTarget}
        onOpenChange={(open) => !open && setAssignTarget(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign to a freelancer</DialogTitle>
            <DialogDescription>
              {assignTarget?.serviceTitle} — {assignTarget?.orgName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Freelancer</FieldLabel>
              <FieldContent>
                {!freelancers?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No freelancers yet. Invite one first.
                  </p>
                ) : (
                  <Select
                    value={assignForm.freelancerId || undefined}
                    onValueChange={(v) =>
                      setAssignForm({ ...assignForm, freelancerId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a freelancer" />
                    </SelectTrigger>
                    <SelectContent>
                      {freelancers.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} · {f.tasks.open} open
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FieldContent>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Priority</FieldLabel>
                <FieldContent>
                  <Select
                    value={assignForm.priority}
                    onValueChange={(v) =>
                      setAssignForm({
                        ...assignForm,
                        priority: v as TaskPriority,
                      })
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
                    value={assignForm.deadline}
                    onChange={(e) =>
                      setAssignForm({
                        ...assignForm,
                        deadline: e.target.value,
                      })
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
                  value={assignForm.payout}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, payout: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  What you'll pay the freelancer for this job. Added to their
                  balance when they mark the task done. Leave empty for unpaid.
                </p>
              </FieldContent>
            </Field>
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Description</FieldLabel>
                {assignTarget && (
                  <button
                    type="button"
                    onClick={() =>
                      setAssignForm({
                        ...assignForm,
                        description: defaultDescription(assignTarget.orgName),
                      })
                    }
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <FieldContent>
                <Textarea
                  className="min-h-28"
                  placeholder="What the freelancer should do — deliverables, tone, gotchas…"
                  value={assignForm.description}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      description: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  This is what the freelancer sees on their task page. Theme,
                  custom design URL and hosting credentials are attached
                  automatically.
                </p>
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitAssign}
              disabled={assignTask.isPending || !assignForm.freelancerId}
            >
              {assignTask.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revisionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRevisionTarget(null)
            setRevisionNote("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request revision</DialogTitle>
            <DialogDescription>
              Tell the freelancer what needs fixing on &quot;
              {revisionTarget?.title}&quot;. The task goes back to them to
              update and resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-28"
            placeholder="What needs to change…"
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevisionTarget(null)
                setRevisionNote("")
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!revisionNote.trim() || requestRevision.isPending}
              onClick={() =>
                revisionTarget &&
                requestRevision.mutate({
                  id: revisionTarget.id,
                  note: revisionNote.trim(),
                })
              }
            >
              {requestRevision.isPending ? "Sending…" : "Send for revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove freelancer"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name} (${deleteTarget.email})? Their assigned tasks will be removed too.`
            : ""
        }
        onConfirm={() =>
          deleteTarget && deleteFreelancer.mutate({ id: deleteTarget.id })
        }
        loading={deleteFreelancer.isPending}
      />
    </div>
  )
}
