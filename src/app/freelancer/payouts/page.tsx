"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { PayoutStatus } from "@/generated/prisma/enums"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BankDetailsPicker,
  emptyBankForm,
  resolveBankForm,
  validateBankForm,
  type BankFormValue,
} from "@/components/bank-details-picker"
import {
  WalletIcon,
  BanknoteIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  XIcon,
  PlusIcon,
  InboxIcon,
} from "lucide-react"

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
    label: "Paid",
    className: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
    icon: CheckCircle2Icon,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-500 ring-red-500/25",
    icon: XCircleIcon,
  },
}

const METHODS = [
  { value: "bank", label: "Bank" },
  { value: "bkash", label: "bKash" },
]

export default function FreelancerPayoutsPage() {
  const utils = trpc.useUtils()
  const { data: balance } = trpc.payouts.myBalance.useQuery()
  const { data: payouts, isLoading } = trpc.payouts.myList.useQuery()

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [bankForm, setBankForm] = useState<BankFormValue>(() =>
    emptyBankForm("bank"),
  )

  const request = trpc.payouts.request.useMutation({
    onSuccess: () => {
      utils.payouts.myBalance.invalidate()
      utils.payouts.myList.invalidate()
      utils.tasks.myBalance.invalidate()
      utils.bankAccounts.list.invalidate()
      toast.success("Payout request submitted")
      setOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const cancel = trpc.payouts.cancelMine.useMutation({
    onSuccess: () => {
      utils.payouts.myBalance.invalidate()
      utils.payouts.myList.invalidate()
      utils.tasks.myBalance.invalidate()
      toast.success("Request cancelled")
    },
    onError: (err) => toast.error(err.message),
  })

  const openDialog = () => {
    setAmount((balance?.available ?? 0).toFixed(2))
    setNote("")
    setBankForm(emptyBankForm("bank"))
    setOpen(true)
  }

  const submit = () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    const err = validateBankForm(bankForm)
    if (err) {
      toast.error(err)
      return
    }
    request.mutate({
      amount: amt,
      note: note.trim() || undefined,
      ...resolveBankForm(bankForm),
    })
  }

  const canRequest = (balance?.available ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Withdraw your earned balance to your bank account.
          </p>
        </div>
        <Button onClick={openDialog} disabled={!canRequest}>
          <PlusIcon className="mr-1.5 size-4" />
          Request payout
        </Button>
      </div>

      {/* Balance breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard
          icon={<WalletIcon className="size-4 text-emerald-500" />}
          label="Available"
          amount={balance?.available ?? 0}
          tone="emerald"
          hint="Ready to withdraw"
        />
        <BalanceCard
          icon={<ClockIcon className="size-4 text-amber-500" />}
          label="Awaiting approval"
          amount={balance?.requested ?? 0}
          hint="In review by admin"
        />
        <BalanceCard
          icon={<BanknoteIcon className="size-4 text-sky-500" />}
          label="Paid out"
          amount={balance?.paidOut ?? 0}
          hint="Lifetime withdrawn"
        />
        <BalanceCard
          icon={<CheckCircle2Icon className="size-4 text-muted-foreground" />}
          label="Total earned"
          amount={balance?.earned ?? 0}
          hint="Lifetime earnings"
        />
      </div>

      {/* History */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
        </div>
      ) : !payouts?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <InboxIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No payout requests yet.
            </p>
            {canRequest && (
              <p className="text-xs text-muted-foreground">
                You have ${(balance?.available ?? 0).toFixed(2)} available —
                request it above.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin note</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => {
                const meta = statusMeta[p.status]
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${p.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.method}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.className}`}
                      >
                        <meta.icon className="size-3" />
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {p.adminNote || "—"}
                    </TableCell>
                    <TableCell>
                      {p.status === "pending" && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-red-500"
                          title="Cancel request"
                          onClick={() => cancel.mutate({ id: p.id })}
                          disabled={cancel.isPending}
                        >
                          <XIcon className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Request dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request payout</DialogTitle>
            <DialogDescription>
              Your admin will review and approve the payment. Available balance:{" "}
              <span className="font-semibold text-foreground">
                ${(balance?.available ?? 0).toFixed(2)}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <Field>
              <FieldLabel>Amount (USD)</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                />
              </FieldContent>
            </Field>

            <BankDetailsPicker
              value={bankForm}
              onChange={setBankForm}
              methods={METHODS}
            />

            <Field>
              <FieldLabel>Note (optional)</FieldLabel>
              <FieldContent>
                <Textarea
                  className="min-h-20"
                  placeholder="Anything the admin should know…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={request.isPending}>
              {request.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BalanceCard({
  icon,
  label,
  amount,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  amount: number
  hint?: string
  tone?: "emerald"
}) {
  return (
    <Card
      className={
        tone === "emerald"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : undefined
      }
    >
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        <p
          className={`text-2xl font-bold ${
            tone === "emerald" ? "text-emerald-500" : ""
          }`}
        >
          ${amount.toFixed(2)}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
