"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  BankDetailsPicker,
  emptyBankForm,
  resolveBankForm,
  validateBankForm,
  type BankFormValue,
} from "@/components/bank-details-picker"
import {
  WalletIcon,
  PlusIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  ReceiptIcon,
  HourglassIcon,
  BanknoteIcon,
  XIcon,
} from "lucide-react"

const QR_CONTENT =
  "00020101021126540013com.pathaopay01020302041008031991008200186593649045204739953030505802BD5907WEBMOSH60045460625002110186593649003085594973007082f9893880807PAYMENT63049E3F"

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-500" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-500" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-500" },
}

const typeMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; sign: string }
> = {
  topup: { label: "Add money", icon: ArrowDownLeftIcon, sign: "+" },
  payout: { label: "Payout", icon: ArrowUpRightIcon, sign: "−" },
  invoice_payment: { label: "Invoice payment", icon: ReceiptIcon, sign: "−" },
  external_payment: { label: "Invoice payment (Bangla QR)", icon: ReceiptIcon, sign: "−" },
}

export default function WalletPage() {
  const utils = trpc.useUtils()
  const { data: balance } = trpc.wallet.myBalance.useQuery()
  const { data: transactions } = trpc.wallet.myTransactions.useQuery()
  const { data: settings } = trpc.settings.getAll.useQuery()
  const rate = settings?.usd_to_bdt_rate ? parseFloat(settings.usd_to_bdt_rate) : null

  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState("")
  const [topupMethod, setTopupMethod] = useState("BanglaQR")
  const [topupTrx, setTopupTrx] = useState("")

  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState("")
  const [payoutNote, setPayoutNote] = useState("")
  const [bankForm, setBankForm] = useState<BankFormValue>(() =>
    emptyBankForm("bank"),
  )

  const invalidate = () => {
    utils.wallet.myBalance.invalidate()
    utils.wallet.myTransactions.invalidate()
  }

  const topup = trpc.wallet.topup.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Top-up submitted — it will be added after verification")
      setTopupOpen(false)
      setTopupAmount("")
      setTopupTrx("")
    },
    onError: (e) => toast.error(e.message),
  })

  const requestPayout = trpc.wallet.requestPayout.useMutation({
    onSuccess: () => {
      invalidate()
      utils.bankAccounts.list.invalidate()
      toast.success("Payout requested — we'll process it shortly")
      setPayoutOpen(false)
      setPayoutAmount("")
      setPayoutNote("")
    },
    onError: (e) => toast.error(e.message),
  })

  const openPayout = () => {
    setPayoutAmount("")
    setPayoutNote("")
    setBankForm(emptyBankForm("bank"))
    setPayoutOpen(true)
  }

  const cancel = trpc.wallet.cancel.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Request cancelled")
    },
    onError: (e) => toast.error(e.message),
  })

  const topupNum = parseFloat(topupAmount)
  const topupBdt = rate && topupNum > 0 ? (topupNum * rate).toFixed(2) : null

  const submitPayout = () => {
    const amount = parseFloat(payoutAmount)
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount.")
      return
    }
    const err = validateBankForm(bankForm)
    if (err) {
      toast.error(err)
      return
    }
    requestPayout.mutate({
      amount,
      note: payoutNote || undefined,
      ...resolveBankForm(bankForm),
    })
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Add money, pay invoices instantly, or withdraw your balance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openPayout}>
            <ArrowUpRightIcon className="size-4" />
            Request payout
          </Button>
          <Button onClick={() => setTopupOpen(true)}>
            <PlusIcon className="size-4" />
            Add money
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-transparent">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <WalletIcon className="size-3.5" />
              Available balance
            </CardDescription>
            <CardTitle className="text-3xl">
              ${(balance?.available ?? 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <HourglassIcon className="size-3.5" />
              Pending top-ups
            </CardDescription>
            <CardTitle className="text-2xl">
              ${(balance?.pendingTopup ?? 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <BanknoteIcon className="size-3.5" />
              Payout in review
            </CardDescription>
            <CardTitle className="text-2xl">
              ${(balance?.lockedPayout ?? 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ReceiptIcon className="size-3.5" />
              Spent on invoices
            </CardDescription>
            <CardTitle className="text-2xl">
              ${(balance?.spent ?? 0).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
          <CardDescription>
            Top-ups are added after verification; payouts are deducted once approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <WalletIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No transactions yet. Add money to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const meta = typeMeta[tx.type] ?? typeMeta.topup
                  const st = statusBadge[tx.status] ?? statusBadge.pending
                  const cancellable =
                    tx.status === "pending" &&
                    (tx.type === "topup" || tx.type === "payout")
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <meta.icon className="size-4 text-muted-foreground" />
                          <span className="font-medium">{meta.label}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`font-semibold ${
                          meta.sign === "+" ? "text-emerald-500" : ""
                        }`}
                      >
                        {meta.sign}${tx.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="hidden max-w-48 sm:table-cell">
                        <p className="truncate text-sm text-muted-foreground">
                          {tx.type === "invoice_payment" && tx.invoice
                            ? `Invoice #${tx.invoice.number}`
                            : tx.method ?? "—"}
                          {tx.transactionId ? ` · ${tx.transactionId}` : ""}
                        </p>
                        {tx.adminNote && (
                          <p className="truncate text-xs text-muted-foreground">
                            Note: {tx.adminNote}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${st.className} hover:${st.className}`}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {cancellable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate({ id: tx.id })}
                          >
                            <XIcon className="size-3.5" />
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add money */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add money to wallet</DialogTitle>
            <DialogDescription>
              Pay with Bangla QR or bKash, then paste the transaction ID. Your
              balance is credited once we verify the payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topup-amount">Amount (USD)</Label>
              <Input
                id="topup-amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 50"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
              {topupBdt && (
                <p className="text-xs text-muted-foreground">≈ ৳{topupBdt} BDT</p>
              )}
            </div>

            <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-4">
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={QR_CONTENT} size={180} level="M" />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Scan with any Bangla QR enabled app (bKash, Nagad, Rocket, bank app)
                and pay {topupBdt ? <strong>৳{topupBdt}</strong> : "the amount"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={topupMethod} onValueChange={setTopupMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BanglaQR">Bangla QR</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topup-trx">Transaction ID (TrxID)</Label>
              <Input
                id="topup-trx"
                placeholder="Paste the transaction ID after paying"
                value={topupTrx}
                onChange={(e) => setTopupTrx(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={
                !topupNum || topupNum <= 0 || !topupTrx.trim() || topup.isPending
              }
              onClick={() =>
                topup.mutate({
                  amount: topupNum,
                  method: topupMethod as "bkash" | "BanglaQR",
                  transactionId: topupTrx,
                })
              }
            >
              {topup.isPending ? "Submitting…" : "Submit top-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request payout */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request payout</DialogTitle>
            <DialogDescription>
              Withdraw from your available balance ($
              {(balance?.available ?? 0).toFixed(2)}). The amount is deducted once
              the payout is approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="po-amount">Amount (USD)</Label>
              <Input
                id="po-amount"
                type="number"
                min="1"
                step="0.01"
                max={balance?.available}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
            </div>

            <BankDetailsPicker
              value={bankForm}
              onChange={setBankForm}
              methods={[
                { value: "bank", label: "Bank" },
                { value: "bkash", label: "bKash" },
              ]}
            />

            <div className="space-y-2">
              <Label htmlFor="po-note">Note (optional)</Label>
              <Textarea
                id="po-note"
                rows={2}
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={requestPayout.isPending}
              onClick={submitPayout}
            >
              {requestPayout.isPending ? "Submitting…" : "Request payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-center text-xs text-muted-foreground">
        Need to pay an invoice?{" "}
        <Link href="/account/invoices" className="text-sky-500 hover:underline">
          Go to Invoices
        </Link>{" "}
        — unpaid invoices can be settled instantly with your wallet balance.
      </p>
    </div>
  )
}
