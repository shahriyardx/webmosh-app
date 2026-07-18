"use client"

import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  WalletIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ReceiptIcon,
  CheckIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react"

type WalletTx = inferRouterOutputs<AppRouter>["wallet"]["listAll"][number]

const statusBadge: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  approved: "bg-emerald-500/15 text-emerald-500",
  rejected: "bg-red-500/15 text-red-500",
}

const typeMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  topup: { label: "Top-up", icon: ArrowDownLeftIcon },
  payout: { label: "Payout", icon: ArrowUpRightIcon },
  invoice_payment: { label: "Invoice payment", icon: ReceiptIcon },
}

const bankLabels: Record<string, string> = {
  accountName: "Account holder",
  accountNumber: "Account number",
  bankName: "Bank",
  branch: "Branch",
  routingNumber: "Routing number",
  swift: "SWIFT",
  iban: "IBAN",
}

export default function AdminWalletPage() {
  const utils = trpc.useUtils()
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const { data: transactions } = trpc.wallet.listAll.useQuery(
    typeFilter === "all"
      ? undefined
      : { type: typeFilter as "topup" | "payout" | "invoice_payment" },
  )

  const [expanded, setExpanded] = useState<string | null>(null)
  const [decision, setDecision] = useState<{
    tx: WalletTx
    action: "approve" | "reject"
  } | null>(null)
  const [adminNote, setAdminNote] = useState("")

  const invalidate = () => utils.wallet.listAll.invalidate()

  const approve = trpc.wallet.approve.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Transaction approved")
      setDecision(null)
      setAdminNote("")
    },
    onError: (e) => toast.error(e.message),
  })

  const reject = trpc.wallet.reject.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Transaction rejected")
      setDecision(null)
      setAdminNote("")
    },
    onError: (e) => toast.error(e.message),
  })

  const sorted = useMemo(() => {
    if (!transactions) return []
    return [...transactions].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1
      if (a.status !== "pending" && b.status === "pending") return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [transactions])

  const pendingTopups = transactions?.filter(
    (t) => t.type === "topup" && t.status === "pending",
  )
  const pendingPayouts = transactions?.filter(
    (t) => t.type === "payout" && t.status === "pending",
  )
  const sum = (list?: WalletTx[]) =>
    (list ?? []).reduce((s, t) => s + t.amount, 0)

  const submitDecision = () => {
    if (!decision) return
    const input = { id: decision.tx.id, adminNote: adminNote || undefined }
    if (decision.action === "approve") approve.mutate(input)
    else reject.mutate(input)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client wallets</h1>
          <p className="text-sm text-muted-foreground">
            Verify top-ups, approve payout requests, and review wallet activity.
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All transactions</SelectItem>
            <SelectItem value="topup">Top-ups</SelectItem>
            <SelectItem value="payout">Payouts</SelectItem>
            <SelectItem value="invoice_payment">Invoice payments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top-ups awaiting verification</CardDescription>
            <CardTitle className="text-2xl">
              {pendingTopups?.length ?? 0}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                (${sum(pendingTopups).toFixed(2)})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payout requests pending</CardDescription>
            <CardTitle className="text-2xl">
              {pendingPayouts?.length ?? 0}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                (${sum(pendingPayouts).toFixed(2)})
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!sorted.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <WalletIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No wallet transactions yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((tx) => {
                  const meta = typeMeta[tx.type] ?? typeMeta.topup
                  const bank = (tx.bankDetails ?? null) as Record<
                    string,
                    string
                  > | null
                  const isExpanded = expanded === tx.id
                  return (
                    <Fragment key={tx.id}>
                      <TableRow>
                        <TableCell>
                          <p className="font-medium">{tx.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.user.email}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <meta.icon className="size-4 text-muted-foreground" />
                            {meta.label}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden max-w-48 md:table-cell">
                          <p className="truncate text-sm text-muted-foreground">
                            {tx.type === "invoice_payment" && tx.invoice
                              ? `Invoice #${tx.invoice.number}`
                              : tx.method ?? "—"}
                            {tx.transactionId ? ` · ${tx.transactionId}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${statusBadge[tx.status]} hover:${statusBadge[tx.status]} capitalize`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {(bank || tx.note) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                title="Details"
                                onClick={() =>
                                  setExpanded(isExpanded ? null : tx.id)
                                }
                              >
                                {isExpanded ? (
                                  <ChevronUpIcon className="size-4" />
                                ) : (
                                  <ChevronDownIcon className="size-4" />
                                )}
                              </Button>
                            )}
                            {tx.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-emerald-600"
                                  onClick={() =>
                                    setDecision({ tx, action: "approve" })
                                  }
                                >
                                  <CheckIcon className="size-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() =>
                                    setDecision({ tx, action: "reject" })
                                  }
                                >
                                  <XIcon className="size-3.5" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7}>
                            <div className="grid gap-2 py-1 sm:grid-cols-3">
                              {bank &&
                                Object.entries(bank)
                                  .filter(([, v]) => v)
                                  .map(([k, v]) => (
                                    <div key={k}>
                                      <p className="text-xs text-muted-foreground">
                                        {bankLabels[k] ?? k}
                                      </p>
                                      <p className="text-sm font-medium">{v}</p>
                                    </div>
                                  ))}
                              {tx.note && (
                                <div className="sm:col-span-3">
                                  <p className="text-xs text-muted-foreground">
                                    Client note
                                  </p>
                                  <p className="text-sm">{tx.note}</p>
                                </div>
                              )}
                              {tx.adminNote && (
                                <div className="sm:col-span-3">
                                  <p className="text-xs text-muted-foreground">
                                    Admin note
                                  </p>
                                  <p className="text-sm">{tx.adminNote}</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) {
            setDecision(null)
            setAdminNote("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {decision && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {decision.action === "approve" ? "Approve" : "Reject"}{" "}
                  {typeMeta[decision.tx.type]?.label.toLowerCase()} of $
                  {decision.tx.amount.toFixed(2)}
                </DialogTitle>
                <DialogDescription>
                  {decision.tx.type === "topup"
                    ? decision.action === "approve"
                      ? "The amount will be credited to the client's wallet."
                      : "The top-up will be rejected and nothing is credited."
                    : decision.action === "approve"
                      ? "Approving deducts the amount from the client's wallet — make sure you've sent the money."
                      : "Rejecting unlocks the amount back into the client's available balance."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="wallet-admin-note">Note (optional)</Label>
                <Textarea
                  id="wallet-admin-note"
                  rows={2}
                  placeholder="Visible to the client"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant={decision.action === "approve" ? "default" : "destructive"}
                  className="w-full"
                  disabled={approve.isPending || reject.isPending}
                  onClick={submitDecision}
                >
                  {approve.isPending || reject.isPending
                    ? "Working…"
                    : decision.action === "approve"
                      ? "Approve"
                      : "Reject"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
