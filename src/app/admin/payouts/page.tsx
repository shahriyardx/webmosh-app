"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { PayoutStatus } from "@/generated/prisma/enums"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  WalletIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  BanknoteIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react"

type BankDetails = {
  accountName?: string
  accountNumber?: string
  bankName?: string
  branch?: string
  routingNumber?: string
  swift?: string
  iban?: string
}

const statusMeta: Record<
  PayoutStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
    icon: ClockIcon,
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
    icon: CheckCircle2Icon,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-500 ring-red-500/25",
    icon: XCircleIcon,
  },
}

export default function AdminPayoutsPage() {
  const utils = trpc.useUtils()
  const { data: payouts, isLoading } = trpc.payouts.listAll.useQuery()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [decisionTarget, setDecisionTarget] = useState<{
    id: string
    action: "approve" | "reject"
    freelancerName: string
    amount: number
  } | null>(null)
  const [adminNote, setAdminNote] = useState("")

  const approve = trpc.payouts.approve.useMutation({
    onSuccess: () => {
      utils.payouts.listAll.invalidate()
      toast.success("Payout approved")
      setDecisionTarget(null)
      setAdminNote("")
    },
    onError: (err) => toast.error(err.message),
  })

  const reject = trpc.payouts.reject.useMutation({
    onSuccess: () => {
      utils.payouts.listAll.invalidate()
      toast.success("Payout rejected")
      setDecisionTarget(null)
      setAdminNote("")
    },
    onError: (err) => toast.error(err.message),
  })

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = () => {
    if (!decisionTarget) return
    const payload = {
      id: decisionTarget.id,
      adminNote: adminNote.trim() || undefined,
    }
    if (decisionTarget.action === "approve") {
      approve.mutate(payload)
    } else {
      reject.mutate(payload)
    }
  }

  const pending = payouts?.filter((p) => p.status === "pending") ?? []
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0)
  const totalApproved =
    payouts?.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0) ?? 0

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve freelancer withdrawal requests. Approving deducts from their
          balance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ClockIcon className="size-4 text-amber-500" />}
          label="Pending requests"
          value={pending.length.toString()}
          hint={`$${totalPending.toFixed(2)} awaiting decision`}
        />
        <StatCard
          icon={<BanknoteIcon className="size-4 text-emerald-500" />}
          label="Total paid out"
          value={`$${totalApproved.toFixed(2)}`}
          hint="Approved lifetime"
        />
        <StatCard
          icon={<WalletIcon className="size-4 text-sky-500" />}
          label="Requests total"
          value={(payouts?.length ?? 0).toString()}
          hint="Across all statuses"
        />
      </div>

      {!payouts?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <WalletIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No payout requests yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Freelancer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => {
                const meta = statusMeta[p.status]
                const isOpen = expanded.has(p.id)
                const bank = (p.bankDetails as BankDetails | null) ?? {}
                const initials = (p.freelancer?.name ?? "?")
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
                return (
                  <>
                    <TableRow key={p.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(p.id)}
                          className="rounded-md p-1 hover:bg-muted"
                          title={isOpen ? "Collapse" : "Expand"}
                        >
                          {isOpen ? (
                            <ChevronDownIcon className="size-4" />
                          ) : (
                            <ChevronRightIcon className="size-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarImage src={p.freelancer?.image ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {p.freelancer?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.freelancer?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${p.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.method}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.className}`}
                        >
                          <meta.icon className="size-3" />
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.status === "pending" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecisionTarget({
                                  id: p.id,
                                  action: "approve",
                                  freelancerName: p.freelancer?.name ?? "—",
                                  amount: p.amount,
                                })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500"
                              onClick={() =>
                                setDecisionTarget({
                                  id: p.id,
                                  action: "reject",
                                  freelancerName: p.freelancer?.name ?? "—",
                                  amount: p.amount,
                                })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {p.decidedAt
                              ? `Decided ${new Date(p.decidedAt).toLocaleDateString()}`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${p.id}-detail`} className="bg-muted/20">
                        <TableCell colSpan={7}>
                          <div className="grid gap-4 p-3 md:grid-cols-2">
                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Bank / payout details
                              </p>
                              <dl className="grid grid-cols-2 gap-2 text-sm">
                                <DetailRow label="Account name" value={bank.accountName} />
                                <DetailRow label="Account #" value={bank.accountNumber} mono />
                                <DetailRow label="Bank" value={bank.bankName} />
                                <DetailRow label="Branch" value={bank.branch} />
                                <DetailRow label="Routing" value={bank.routingNumber} mono />
                                <DetailRow label="SWIFT" value={bank.swift} mono />
                                <DetailRow label="IBAN" value={bank.iban} mono />
                              </dl>
                            </div>
                            <div className="space-y-3">
                              {p.note && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Freelancer note
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">
                                    {p.note}
                                  </p>
                                </div>
                              )}
                              {p.adminNote && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Admin note
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm">
                                    {p.adminNote}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!decisionTarget}
        onOpenChange={(open) => !open && setDecisionTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.action === "approve"
                ? "Approve payout"
                : "Reject payout"}
            </DialogTitle>
            <DialogDescription>
              {decisionTarget?.action === "approve"
                ? `Confirm you've paid $${decisionTarget?.amount.toFixed(
                    2,
                  )} to ${decisionTarget?.freelancerName}. Their balance will be reduced by this amount.`
                : `Reject the $${decisionTarget?.amount.toFixed(
                    2,
                  )} request from ${decisionTarget?.freelancerName}. Their balance is unlocked.`}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Note to freelancer (optional)</FieldLabel>
            <FieldContent>
              <Textarea
                className="min-h-20"
                placeholder={
                  decisionTarget?.action === "approve"
                    ? "e.g. Sent via Wise on 20/07/2026, ref #123"
                    : "Reason for rejection or next steps…"
                }
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </FieldContent>
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDecisionTarget(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={approve.isPending || reject.isPending}
              variant={
                decisionTarget?.action === "reject" ? "destructive" : "default"
              }
            >
              {approve.isPending || reject.isPending
                ? "Submitting…"
                : decisionTarget?.action === "approve"
                ? "Approve payout"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="col-span-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`break-all text-sm ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}
