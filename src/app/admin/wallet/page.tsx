"use client"

import { Fragment, useMemo, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  PlusIcon,
  MinusIcon,
  UsersIcon,
  SlidersHorizontalIcon,
} from "lucide-react"

type WalletTx = inferRouterOutputs<AppRouter>["wallet"]["listAll"][number]
type ClientBalance =
  inferRouterOutputs<AppRouter>["wallet"]["clientBalances"][number]

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
  invoice_payment: { label: "Invoice payment (wallet)", icon: ReceiptIcon },
  external_payment: { label: "Invoice payment (Bangla QR)", icon: ReceiptIcon },
}

/** Label a transaction, distinguishing admin manual adjustments. */
function txLabel(tx: { type: string; method: string | null }) {
  if (tx.method === "admin") {
    return tx.type === "topup" ? "Adjustment (added)" : "Adjustment (removed)"
  }
  return typeMeta[tx.type]?.label ?? tx.type
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
  const [view, setView] = useState<"balances" | "transactions">("balances")

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client wallets</h1>
          <p className="text-sm text-muted-foreground">
            Review balances, verify top-ups, approve payouts, and adjust
            balances manually.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button
            onClick={() => setView("balances")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "balances"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UsersIcon className="size-4" />
            Client balances
          </button>
          <button
            onClick={() => setView("transactions")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "transactions"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ReceiptIcon className="size-4" />
            All transactions
          </button>
        </div>
      </div>

      {view === "balances" ? <BalancesView /> : <TransactionsView />}
    </div>
  )
}

/* ------------------------------ Balances view ----------------------------- */

function BalancesView() {
  const { data: clients, isLoading } = trpc.wallet.clientBalances.useQuery()
  const [detailFor, setDetailFor] = useState<ClientBalance | null>(null)
  const [adjustFor, setAdjustFor] = useState<ClientBalance | null>(null)
  const [search, setSearch] = useState("")

  const totalAvailable = (clients ?? []).reduce((s, c) => s + c.available, 0)
  const withFunds = (clients ?? []).filter((c) => c.available > 0).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients ?? []
    return (clients ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    )
  }, [clients, search])

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total client balance</CardDescription>
            <CardTitle className="text-2xl">
              ${totalAvailable.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clients with a balance</CardDescription>
            <CardTitle className="text-2xl">{withFunds}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Input
            placeholder="Search clients by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
            </div>
          ) : !clients?.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <WalletIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No clients yet.</p>
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <WalletIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No clients match &ldquo;{search}&rdquo;.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Added
                  </TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Spent
                  </TableHead>
                  <TableHead className="hidden text-right lg:table-cell">
                    Pending
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.userId}>
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${c.available.toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm text-muted-foreground md:table-cell">
                      ${c.added.toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm text-muted-foreground md:table-cell">
                      ${c.spent.toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm text-muted-foreground lg:table-cell">
                      {c.pendingTopup > 0 ? `$${c.pendingTopup.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailFor(c)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAdjustFor(c)}
                        >
                          <SlidersHorizontalIcon className="size-3.5" />
                          Adjust
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ClientTransactionsDialog
        client={detailFor}
        onClose={() => setDetailFor(null)}
      />
      <AdjustBalanceDialog
        client={adjustFor}
        onClose={() => setAdjustFor(null)}
      />
    </>
  )
}

function ClientTransactionsDialog({
  client,
  onClose,
}: {
  client: ClientBalance | null
  onClose: () => void
}) {
  const { data: txs, isLoading } = trpc.wallet.listAll.useQuery(
    { userId: client?.userId ?? "" },
    { enabled: !!client },
  )

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        {client && (
          <>
            <DialogHeader>
              <DialogTitle>{client.name}</DialogTitle>
              <DialogDescription>
                {client.email} · Available balance{" "}
                <span className="font-semibold text-foreground">
                  ${client.available.toFixed(2)}
                </span>
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
              </div>
            ) : !txs?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions.
              </p>
            ) : (
              <div className="space-y-2">
                {txs.map((tx) => {
                  const isCredit =
                    tx.type === "topup" && tx.status === "approved"
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{txLabel(tx)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tx.type === "invoice_payment" && tx.invoice
                            ? `Invoice #${tx.invoice.number}`
                            : (tx.method ?? "—")}
                          {tx.transactionId ? ` · ${tx.transactionId}` : ""}
                          {" · "}
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                        {tx.adminNote && (
                          <p className="truncate text-xs text-muted-foreground">
                            Note: {tx.adminNote}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            tx.type === "topup"
                              ? "text-emerald-600"
                              : "text-foreground"
                          }`}
                        >
                          {isCredit || tx.type === "topup" ? "+" : "−"}$
                          {tx.amount.toFixed(2)}
                        </span>
                        <Badge
                          className={`${statusBadge[tx.status]} hover:${statusBadge[tx.status]} capitalize`}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AdjustBalanceDialog({
  client,
  onClose,
}: {
  client: ClientBalance | null
  onClose: () => void
}) {
  const utils = trpc.useUtils()
  const [direction, setDirection] = useState<"add" | "remove">("add")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

  const reset = () => {
    setDirection("add")
    setAmount("")
    setNote("")
  }

  const adjust = trpc.wallet.adjustBalance.useMutation({
    onSuccess: () => {
      utils.wallet.clientBalances.invalidate()
      utils.wallet.listAll.invalidate()
      toast.success("Balance updated")
      reset()
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const submit = () => {
    if (!client) return
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error("Enter an amount greater than 0.")
      return
    }
    if (direction === "remove" && amt > client.available) {
      toast.error(
        `Can't remove more than the available balance ($${client.available.toFixed(2)}).`,
      )
      return
    }
    adjust.mutate({
      userId: client.userId,
      direction,
      amount: amt,
      note: note.trim() || undefined,
    })
  }

  return (
    <Dialog
      open={!!client}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {client && (
          <>
            <DialogHeader>
              <DialogTitle>Adjust balance</DialogTitle>
              <DialogDescription>
                {client.name} · current available{" "}
                <span className="font-semibold text-foreground">
                  ${client.available.toFixed(2)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("add")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition-colors ${
                    direction === "add"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <PlusIcon className="size-4" />
                  Add funds
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("remove")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition-colors ${
                    direction === "remove"
                      ? "border-red-500/50 bg-red-500/10 text-red-600"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <MinusIcon className="size-4" />
                  Remove funds
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust-amount">Amount (USD)</Label>
                <Input
                  id="adjust-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjust-note">Reason / note (optional)</Label>
                <Textarea
                  id="adjust-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Visible to the client on their transaction"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant={direction === "add" ? "default" : "destructive"}
                className="w-full"
                disabled={adjust.isPending}
                onClick={submit}
              >
                {adjust.isPending
                  ? "Working…"
                  : direction === "add"
                    ? "Add to balance"
                    : "Remove from balance"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------- Transactions view --------------------------- */

function TransactionsView() {
  const utils = trpc.useUtils()
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const { data: transactions } = trpc.wallet.listAll.useQuery(
    typeFilter === "all"
      ? undefined
      : {
          type: typeFilter as
            | "topup"
            | "payout"
            | "invoice_payment"
            | "external_payment",
        },
  )

  const [expanded, setExpanded] = useState<string | null>(null)
  const [decision, setDecision] = useState<{
    tx: WalletTx
    action: "approve" | "reject"
  } | null>(null)
  const [adminNote, setAdminNote] = useState("")

  const invalidate = () => {
    utils.wallet.listAll.invalidate()
    utils.wallet.clientBalances.invalidate()
  }

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
    <>
      <div className="flex justify-end">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All transactions</SelectItem>
            <SelectItem value="topup">Top-ups</SelectItem>
            <SelectItem value="payout">Payouts</SelectItem>
            <SelectItem value="invoice_payment">Invoice (wallet)</SelectItem>
            <SelectItem value="external_payment">Invoice (Bangla QR)</SelectItem>
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
                            {txLabel(tx)}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${tx.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden max-w-48 md:table-cell">
                          <p className="truncate text-sm text-muted-foreground">
                            {tx.type === "invoice_payment" && tx.invoice
                              ? `Invoice #${tx.invoice.number}`
                              : (tx.method ?? "—")}
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
                    : decision.tx.type === "external_payment"
                      ? decision.action === "approve"
                        ? "Confirm you received this Bangla QR payment — the invoice will be credited by this amount."
                        : "Rejecting marks the payment as failed; the invoice will not be credited."
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
                  variant={
                    decision.action === "approve" ? "default" : "destructive"
                  }
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
    </>
  )
}
