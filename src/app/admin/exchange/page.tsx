"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import {
  PlusIcon,
  Trash2Icon,
  ArrowLeftRightIcon,
  XIcon,
  PencilIcon,
} from "lucide-react"

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ALL = "__all__"

function todayInput() {
  return new Date(new Date().getTimezoneOffset() * -60000 + Date.now())
    .toISOString()
    .slice(0, 10)
}

type NewTx = {
  date: string
  amount: string
  rate: string
  fromAccount: string
  toAccount: string
  remark: string
}

const emptyTx = (): NewTx => ({
  date: todayInput(),
  amount: "",
  rate: "",
  fromAccount: "",
  toAccount: "",
  remark: "",
})

export default function AdminExchangePage() {
  const utils = trpc.useUtils()

  // Filters
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [toAccount, setToAccount] = useState(ALL)
  const [fromAccount, setFromAccount] = useState(ALL)

  const filterInput = useMemo(
    () => ({
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(`${toDate}T23:59:59`) : undefined,
      fromAccount: fromAccount === ALL ? undefined : fromAccount,
      toAccount: toAccount === ALL ? undefined : toAccount,
    }),
    [fromDate, toDate, fromAccount, toAccount],
  )

  const { data, isLoading } = trpc.exchange.list.useQuery(filterInput)
  const { data: accounts } = trpc.exchange.accounts.useQuery()

  const [form, setForm] = useState<NewTx>(emptyTx)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<NewTx>(emptyTx)

  const invalidate = () => {
    utils.exchange.list.invalidate()
    utils.exchange.accounts.invalidate()
  }

  const create = trpc.exchange.create.useMutation({
    onSuccess: () => {
      invalidate()
      setForm(emptyTx())
      toast.success("Transaction added")
    },
    onError: (e) => toast.error(e.message),
  })
  const update = trpc.exchange.update.useMutation({
    onSuccess: () => {
      invalidate()
      setEditId(null)
      toast.success("Transaction updated")
    },
    onError: (e) => toast.error(e.message),
  })
  const del = trpc.exchange.delete.useMutation({
    onSuccess: () => {
      invalidate()
      setDeleteId(null)
      toast.success("Transaction deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const parse = (f: NewTx) => {
    const amount = parseFloat(f.amount)
    const rate = parseFloat(f.rate)
    if (!f.date) return toast.error("Pick a date."), null
    if (!amount || amount <= 0) return toast.error("Enter a valid amount."), null
    if (!rate || rate <= 0) return toast.error("Enter a valid rate."), null
    if (!f.fromAccount.trim()) return toast.error("Enter a From account."), null
    if (!f.toAccount.trim()) return toast.error("Enter a To account."), null
    return {
      date: new Date(f.date),
      amount,
      rate,
      fromAccount: f.fromAccount.trim(),
      toAccount: f.toAccount.trim(),
      remark: f.remark.trim() || undefined,
    }
  }

  const submit = () => {
    const parsed = parse(form)
    if (parsed) create.mutate(parsed)
  }

  const openEdit = (tx: {
    id: string
    date: Date | string
    amount: number
    rate: number
    fromAccount: string
    toAccount: string
    remark: string | null
  }) => {
    setEditForm({
      date: new Date(tx.date).toISOString().slice(0, 10),
      amount: String(tx.amount),
      rate: String(tx.rate),
      fromAccount: tx.fromAccount,
      toAccount: tx.toAccount,
      remark: tx.remark ?? "",
    })
    setEditId(tx.id)
  }

  const submitEdit = () => {
    if (!editId) return
    const parsed = parse(editForm)
    if (parsed) update.mutate({ id: editId, ...parsed })
  }

  const setField = (patch: Partial<NewTx>) => setForm((f) => ({ ...f, ...patch }))
  const hasFilters =
    fromDate || toDate || toAccount !== ALL || fromAccount !== ALL

  const items = data?.items ?? []

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10">
          <ArrowLeftRightIcon className="size-5 text-sky-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Exchange</h1>
          <p className="text-sm text-muted-foreground">
            Record money exchanges between accounts.
          </p>
        </div>
      </div>

      {/* Add transaction */}
      <Card className="overflow-visible">
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-7">
            <Labeled label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setField({ date: e.target.value })}
              />
            </Labeled>
            <Labeled label="Amount">
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setField({ amount: e.target.value })}
              />
            </Labeled>
            <Labeled label="Rate (BDT)">
              <AutoInput
                type="number"
                placeholder="e.g. 125"
                value={form.rate}
                onChange={(v) => setField({ rate: v })}
                options={accounts?.rates ?? []}
              />
            </Labeled>
            <Labeled label="From account">
              <AutoInput
                placeholder="e.g. Payoneer"
                value={form.fromAccount}
                onChange={(v) => setField({ fromAccount: v })}
                options={accounts?.from ?? []}
              />
            </Labeled>
            <Labeled label="To account">
              <AutoInput
                placeholder="e.g. bKash"
                value={form.toAccount}
                onChange={(v) => setField({ toAccount: v })}
                options={accounts?.to ?? []}
              />
            </Labeled>
            <Labeled label="Remark (optional)">
              <AutoInput
                placeholder="Note…"
                value={form.remark}
                onChange={(v) => setField({ remark: v })}
                options={accounts?.remarks ?? []}
              />
            </Labeled>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={create.isPending}
                onClick={submit}
              >
                <PlusIcon className="size-4" />
                {create.isPending ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
          {form.amount && form.rate && (
            <p className="mt-2 text-xs text-muted-foreground">
              Amount in BDT:{" "}
              <span className="font-semibold text-foreground">
                ৳{money((parseFloat(form.amount) || 0) * (parseFloat(form.rate) || 0))}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Labeled label="From date">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </Labeled>
          <Labeled label="To date">
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </Labeled>
          <Labeled label="From account">
            <Select value={fromAccount} onValueChange={setFromAccount}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                {(accounts?.from ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
          <Labeled label="To account">
            <Select value={toAccount} onValueChange={setToAccount}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                {(accounts?.to ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labeled>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setFromDate("")
                setToDate("")
                setToAccount(ALL)
                setFromAccount(ALL)
              }}
            >
              <XIcon className="size-4" />
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Transactions" value={String(data?.count ?? 0)} />
        <Stat label="Total amount" value={`$${money(data?.totalAmount ?? 0)}`} />
        <Stat
          label="Total in BDT"
          value={`৳${money(data?.totalBdt ?? 0)}`}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Rate (BDT)</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Remark</TableHead>
              <TableHead className="text-right">Amount in BDT</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <div className="mx-auto size-5 animate-pulse rounded-full bg-sky-500/50" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No transactions{hasFilters ? " match these filters" : " yet"}.
                </TableCell>
              </TableRow>
            ) : (
              items.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(tx.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    ${money(tx.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money(tx.rate)}
                  </TableCell>
                  <TableCell className="text-sm">{tx.fromAccount}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {tx.toAccount}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {tx.remark || "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    ৳{money(tx.amount * tx.rate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title="Edit"
                        onClick={() => openEdit(tx)}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-red-500"
                        title="Delete"
                        onClick={() => setDeleteId(tx.id)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit transaction</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Date">
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </Labeled>
            <Labeled label="Amount">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={editForm.amount}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </Labeled>
            <Labeled label="Rate (BDT)">
              <AutoInput
                type="number"
                value={editForm.rate}
                onChange={(v) => setEditForm((f) => ({ ...f, rate: v }))}
                options={accounts?.rates ?? []}
              />
            </Labeled>
            <Labeled label="From account">
              <AutoInput
                value={editForm.fromAccount}
                onChange={(v) =>
                  setEditForm((f) => ({ ...f, fromAccount: v }))
                }
                options={accounts?.from ?? []}
              />
            </Labeled>
            <Labeled label="To account">
              <AutoInput
                value={editForm.toAccount}
                onChange={(v) => setEditForm((f) => ({ ...f, toAccount: v }))}
                options={accounts?.to ?? []}
              />
            </Labeled>
            <Labeled label="Remark (optional)">
              <AutoInput
                value={editForm.remark}
                onChange={(v) => setEditForm((f) => ({ ...f, remark: v }))}
                options={accounts?.remarks ?? []}
              />
            </Labeled>
          </div>
          {editForm.amount && editForm.rate && (
            <p className="text-xs text-muted-foreground">
              Amount in BDT:{" "}
              <span className="font-semibold text-foreground">
                ৳
                {money(
                  (parseFloat(editForm.amount) || 0) *
                    (parseFloat(editForm.rate) || 0),
                )}
              </span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete transaction"
        description="Delete this exchange transaction? This cannot be undone."
        onConfirm={() => deleteId && del.mutate({ id: deleteId })}
        loading={del.isPending}
      />
    </div>
  )
}

/** Input with a styled suggestion dropdown of previously-used values. */
function AutoInput({
  value,
  onChange,
  options,
  placeholder,
  type = "text",
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  type?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    const base = q
      ? options.filter(
          (o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q,
        )
      : options
    return base.slice(0, 8)
  }, [options, value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? 0 : undefined}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open && e.key === "ArrowDown") {
            setOpen(true)
            return
          }
          if (!filtered.length) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((a) => (a + 1) % filtered.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((a) => (a <= 0 ? filtered.length - 1 : a - 1))
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault()
            choose(filtered[active])
          } else if (e.key === "Escape") {
            setOpen(false)
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {filtered.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm text-foreground ${
                  i === active ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-bold tabular-nums text-foreground ${valueClass ?? ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
