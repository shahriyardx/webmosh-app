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
  XIcon,
  PencilIcon,
  CheckIcon,
} from "lucide-react"

export const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const ALL = "__all__"

function todayInput() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

type TxForm = {
  date: string
  amount: string
  rate: string
  fromAccount: string
  toAccount: string
  remark: string
}

const emptyTx = (): TxForm => ({
  date: todayInput(),
  amount: "",
  rate: "",
  fromAccount: "",
  toAccount: "",
  remark: "",
})

type Tx = {
  id: string
  status: "pending" | "approved"
  date: string | Date
  amount: number
  rate: number
  fromAccount: string
  toAccount: string
  remark: string | null
}

export function ExchangeLedger({
  mode,
  userId,
}: {
  mode: "admin" | "client"
  userId?: string
}) {
  const isAdmin = mode === "admin"
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

  const adminList = trpc.exchange.list.useQuery(
    { userId: userId ?? "", ...filterInput },
    { enabled: isAdmin && !!userId },
  )
  const clientList = trpc.exchange.myList.useQuery(filterInput, {
    enabled: !isAdmin,
  })
  const data = isAdmin ? adminList.data : clientList.data
  const isLoading = isAdmin ? adminList.isLoading : clientList.isLoading

  const adminAccounts = trpc.exchange.accounts.useQuery(
    { userId: userId ?? "" },
    { enabled: isAdmin && !!userId },
  )
  const clientAccounts = trpc.exchange.myAccounts.useQuery(undefined, {
    enabled: !isAdmin,
  })
  const accounts = isAdmin ? adminAccounts.data : clientAccounts.data

  const [form, setForm] = useState<TxForm>(emptyTx)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<TxForm>(emptyTx)

  const invalidate = () => {
    utils.exchange.list.invalidate()
    utils.exchange.myList.invalidate()
    utils.exchange.accounts.invalidate()
    utils.exchange.myAccounts.invalidate()
    utils.exchange.enabledClients.invalidate()
  }

  const adminCreate = trpc.exchange.create.useMutation({
    onSuccess: () => {
      invalidate()
      setForm(emptyTx())
      toast.success("Transaction added")
    },
    onError: (e) => toast.error(e.message),
  })
  const clientCreate = trpc.exchange.myCreate.useMutation({
    onSuccess: () => {
      invalidate()
      setForm(emptyTx())
      toast.success("Submitted — awaiting admin approval")
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
  const approve = trpc.exchange.approve.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Transaction approved")
    },
    onError: (e) => toast.error(e.message),
  })
  const adminDelete = trpc.exchange.delete.useMutation({
    onSuccess: () => {
      invalidate()
      setDeleteId(null)
      toast.success("Transaction deleted")
    },
    onError: (e) => toast.error(e.message),
  })
  const clientDelete = trpc.exchange.myDelete.useMutation({
    onSuccess: () => {
      invalidate()
      setDeleteId(null)
      toast.success("Entry removed")
    },
    onError: (e) => toast.error(e.message),
  })

  const parse = (f: TxForm) => {
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
    if (!parsed) return
    if (isAdmin) {
      if (!userId) return
      adminCreate.mutate({ userId, ...parsed })
    } else {
      clientCreate.mutate(parsed)
    }
  }

  const openEdit = (tx: Tx) => {
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

  const doDelete = () => {
    if (!deleteId) return
    if (isAdmin) adminDelete.mutate({ id: deleteId })
    else clientDelete.mutate({ id: deleteId })
  }

  const creating = adminCreate.isPending || clientCreate.isPending
  const setField = (patch: Partial<TxForm>) =>
    setForm((f) => ({ ...f, ...patch }))
  const hasFilters =
    fromDate || toDate || toAccount !== ALL || fromAccount !== ALL
  const items = (data?.items ?? []) as Tx[]

  return (
    <div className="space-y-6">
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
              <Button className="w-full" disabled={creating} onClick={submit}>
                <PlusIcon className="size-4" />
                {creating ? "Saving…" : isAdmin ? "Add" : "Submit"}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {form.amount && form.rate ? (
              <>
                Amount in BDT:{" "}
                <span className="font-semibold text-foreground">
                  ৳
                  {money(
                    (parseFloat(form.amount) || 0) * (parseFloat(form.rate) || 0),
                  )}
                </span>
              </>
            ) : !isAdmin ? (
              "Your entries are added once an admin approves them."
            ) : null}
          </p>
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
            <FilterSelect
              value={fromAccount}
              onChange={setFromAccount}
              options={accounts?.from ?? []}
            />
          </Labeled>
          <Labeled label="To account">
            <FilterSelect
              value={toAccount}
              onChange={setToAccount}
              options={accounts?.to ?? []}
            />
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
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Transactions" value={String(data?.count ?? 0)} />
        <Stat
          label="Pending"
          value={String(data?.pendingCount ?? 0)}
          valueClass={
            (data?.pendingCount ?? 0) > 0
              ? "text-amber-600 dark:text-amber-400"
              : undefined
          }
        />
        <Stat
          label="Total amount (approved)"
          value={`$${money(data?.totalAmount ?? 0)}`}
        />
        <Stat
          label="Total in BDT (approved)"
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
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center">
                  <div className="mx-auto size-5 animate-pulse rounded-full bg-sky-500/50" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No transactions{hasFilters ? " match these filters" : " yet"}.
                </TableCell>
              </TableRow>
            ) : (
              items.map((tx) => {
                const pending = tx.status === "pending"
                return (
                  <TableRow key={tx.id} className={pending ? "bg-amber-500/[0.04]" : ""}>
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          pending
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {pending ? "Pending" : "Approved"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        {isAdmin && pending && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-emerald-600 hover:text-emerald-600"
                            title="Approve"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate({ id: tx.id })}
                          >
                            <CheckIcon className="size-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            title="Edit"
                            onClick={() => openEdit(tx)}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                        )}
                        {(isAdmin || pending) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-500"
                            title={isAdmin ? "Delete" : "Remove pending entry"}
                            onClick={() => setDeleteId(tx.id)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog (admin) */}
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
        onConfirm={doDelete}
        loading={adminDelete.isPending || clientDelete.isPending}
      />
    </div>
  )
}

/* ------------------------------- helpers -------------------------------- */

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

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All accounts</SelectItem>
        {options.map((a) => (
          <SelectItem key={a} value={a}>
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
