"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BanknoteIcon,
  PlusIcon,
  Trash2Icon,
  CheckIcon,
} from "lucide-react"

export type PayoutMethodOption = { value: string; label: string }

export type BankFormValue = {
  mode: "saved" | "new"
  savedId: string | null
  method: string
  accountName: string
  accountNumber: string
  branch: string
  saveNew: boolean
}

export function emptyBankForm(defaultMethod: string): BankFormValue {
  return {
    mode: "new",
    savedId: null,
    method: defaultMethod,
    accountName: "",
    accountNumber: "",
    branch: "",
    saveNew: true,
  }
}

const isBkash = (method: string) => method.toLowerCase() === "bkash"

/** Validate the entered/selected details. Returns an error message or null. */
export function validateBankForm(v: BankFormValue): string | null {
  if (!v.accountName.trim()) return "Account holder name is required."
  if (!v.accountNumber.trim()) {
    return isBkash(v.method)
      ? "bKash account number is required."
      : "Account number is required."
  }
  if (!isBkash(v.method) && !v.branch.trim()) {
    return "Branch is required."
  }
  return null
}

/** Resolve the value into the payout mutation payload. */
export function resolveBankForm(v: BankFormValue) {
  return {
    method: v.method,
    bankDetails: {
      accountName: v.accountName.trim(),
      accountNumber: v.accountNumber.trim(),
      branch:
        !isBkash(v.method) && v.branch.trim() ? v.branch.trim() : undefined,
    },
    saveBankAccount: v.mode === "new" && v.saveNew,
  }
}

function mask(n: string) {
  const s = n.trim()
  if (s.length <= 4) return s
  return `••••${s.slice(-4)}`
}

export function BankDetailsPicker({
  value,
  onChange,
  methods,
}: {
  value: BankFormValue
  onChange: (v: BankFormValue) => void
  methods: PayoutMethodOption[]
}) {
  const utils = trpc.useUtils()
  const { data: accounts } = trpc.bankAccounts.list.useQuery()
  const didInit = useRef(false)

  const labelFor = (m: string) =>
    methods.find((x) => x.value === m)?.label ?? m

  const del = trpc.bankAccounts.delete.useMutation({
    onSuccess: () => {
      utils.bankAccounts.list.invalidate()
      toast.success("Saved account removed")
    },
    onError: (e) => toast.error(e.message),
  })

  const fromSaved = (a: {
    id: string
    method: string
    accountName: string
    accountNumber: string
    branch: string | null
  }): BankFormValue => ({
    mode: "saved",
    savedId: a.id,
    method: a.method,
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    branch: a.branch ?? "",
    saveNew: false,
  })

  // Default to the first saved account the first time the list loads.
  useEffect(() => {
    if (didInit.current || !accounts) return
    didInit.current = true
    if (accounts.length > 0) onChange(fromSaved(accounts[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  const selectSaved = (id: string) => {
    const a = accounts?.find((x) => x.id === id)
    if (a) onChange(fromSaved(a))
  }

  const useNew = () => onChange(emptyBankForm(methods[0]?.value ?? value.method))

  const set = (patch: Partial<BankFormValue>) => onChange({ ...value, ...patch })

  const hasSaved = (accounts?.length ?? 0) > 0
  const bkash = isBkash(value.method)

  return (
    <div className="space-y-4">
      {/* Saved accounts */}
      {hasSaved && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Saved accounts</p>
          <div className="space-y-2">
            {accounts!.map((a) => {
              const active = value.mode === "saved" && value.savedId === a.id
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-sky-500/50 bg-sky-500/5 ring-1 ring-inset ring-sky-500/20"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectSaved(a.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-sky-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {active ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <BanknoteIcon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.accountName}{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {mask(a.accountNumber)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {labelFor(a.method)}
                        {a.branch ? ` · ${a.branch}` : ""}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => del.mutate({ id: a.id })}
                    disabled={del.isPending}
                    className="shrink-0 text-muted-foreground hover:text-red-500"
                    title="Remove saved account"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={useNew}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed p-2.5 text-sm font-medium transition-colors ${
              value.mode === "new"
                ? "border-sky-500/50 bg-sky-500/5 text-sky-500"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            <PlusIcon className="size-4" />
            Use a new account
          </button>
        </div>
      )}

      {/* New account form */}
      {value.mode === "new" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
          {hasSaved && <p className="text-sm font-semibold">New account</p>}
          <Field>
            <FieldLabel>Method</FieldLabel>
            <FieldContent>
              <Select
                value={value.method}
                onValueChange={(v) => set({ method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Account holder name</FieldLabel>
            <FieldContent>
              <Input
                value={value.accountName}
                onChange={(e) => set({ accountName: e.target.value })}
                placeholder="Priya Sharma"
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>
              {bkash ? "bKash account number" : "Account number"}
            </FieldLabel>
            <FieldContent>
              <Input
                value={value.accountNumber}
                onChange={(e) => set({ accountNumber: e.target.value })}
                placeholder={bkash ? "01XXXXXXXXX" : "1234567890"}
              />
            </FieldContent>
          </Field>

          {!bkash && (
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <FieldContent>
                <Input
                  value={value.branch}
                  onChange={(e) => set({ branch: e.target.value })}
                  placeholder="Dhaka main branch"
                />
              </FieldContent>
            </Field>
          )}

          <label className="flex cursor-pointer items-center gap-2 pt-1">
            <Checkbox
              checked={value.saveNew}
              onCheckedChange={(c) => set({ saveNew: c === true })}
            />
            <span className="text-sm">
              Save this account for future payouts
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
