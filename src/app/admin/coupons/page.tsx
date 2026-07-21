"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  TicketPercentIcon,
  XIcon,
} from "lucide-react"

type Coupon = inferRouterOutputs<AppRouter>["coupons"]["list"][number]

type CondType =
  | "min_subtotal"
  | "max_discount"
  | "service_type"
  | "country"
  | "usage_limit"
  | "per_user_limit"
  | "first_order_only"
  | "starts_at"
  | "expires_at"

const CONDITION_META: Record<CondType, { label: string; desc: string }> = {
  min_subtotal: {
    label: "Minimum order amount",
    desc: "Only valid when the order total is at least this amount.",
  },
  max_discount: {
    label: "Maximum discount cap",
    desc: "Never discount more than this dollar amount.",
  },
  service_type: {
    label: "Service type",
    desc: "Only valid for orders including this kind of service.",
  },
  country: {
    label: "Country",
    desc: "Only valid for orders in this region.",
  },
  usage_limit: {
    label: "Total usage limit",
    desc: "Maximum number of times this coupon can be redeemed overall.",
  },
  per_user_limit: {
    label: "Per-customer limit",
    desc: "Maximum redemptions per customer.",
  },
  first_order_only: {
    label: "First order only",
    desc: "Only valid on a customer's very first payment.",
  },
  starts_at: {
    label: "Start date",
    desc: "Coupon becomes active on this date.",
  },
  expires_at: {
    label: "Expiry date",
    desc: "Coupon stops working after this date.",
  },
}

const CONDITION_ORDER: CondType[] = [
  "min_subtotal",
  "max_discount",
  "service_type",
  "country",
  "usage_limit",
  "per_user_limit",
  "first_order_only",
  "starts_at",
  "expires_at",
]

type FormState = {
  id: string | null
  code: string
  description: string
  discountType: "percent" | "fixed"
  discountValue: string
  enabled: boolean
  minSubtotal: string
  maxDiscount: string
  serviceType: "general" | "wordpress"
  country: "uk" | "us"
  usageLimit: string
  perUserLimit: string
  startsAt: string
  expiresAt: string
  conditions: CondType[]
}

const EMPTY_FORM: FormState = {
  id: null,
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  enabled: true,
  minSubtotal: "",
  maxDiscount: "",
  serviceType: "general",
  country: "uk",
  usageLimit: "",
  perUserLimit: "",
  startsAt: "",
  expiresAt: "",
  conditions: [],
}

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return ""
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ""
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function couponToForm(c: Coupon): FormState {
  const conditions: CondType[] = []
  if (c.minSubtotal != null) conditions.push("min_subtotal")
  if (c.maxDiscount != null) conditions.push("max_discount")
  if (c.serviceType) conditions.push("service_type")
  if (c.country) conditions.push("country")
  if (c.usageLimit != null) conditions.push("usage_limit")
  if (c.perUserLimit != null) conditions.push("per_user_limit")
  if (c.firstOrderOnly) conditions.push("first_order_only")
  if (c.startsAt) conditions.push("starts_at")
  if (c.expiresAt) conditions.push("expires_at")
  return {
    id: c.id,
    code: c.code,
    description: c.description ?? "",
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    enabled: c.enabled,
    minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : "",
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
    serviceType: (c.serviceType as "general" | "wordpress") ?? "general",
    country: (c.country as "uk" | "us") ?? "uk",
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
    perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : "",
    startsAt: toLocalInput(c.startsAt),
    expiresAt: toLocalInput(c.expiresAt),
    conditions,
  }
}

function discountLabel(c: Coupon) {
  return c.discountType === "percent"
    ? `${c.discountValue}% off`
    : `$${c.discountValue} off`
}

function conditionChips(c: Coupon): string[] {
  const chips: string[] = []
  if (c.minSubtotal != null) chips.push(`Min $${c.minSubtotal}`)
  if (c.maxDiscount != null) chips.push(`Cap $${c.maxDiscount}`)
  if (c.serviceType)
    chips.push(c.serviceType === "wordpress" ? "WordPress" : "General")
  if (c.country) chips.push(c.country.toUpperCase())
  if (c.usageLimit != null) chips.push(`${c.usageLimit} total uses`)
  if (c.perUserLimit != null) chips.push(`${c.perUserLimit}/customer`)
  if (c.firstOrderOnly) chips.push("First order only")
  if (c.startsAt) chips.push(`From ${new Date(c.startsAt).toLocaleDateString()}`)
  if (c.expiresAt)
    chips.push(`Until ${new Date(c.expiresAt).toLocaleDateString()}`)
  return chips
}

export default function AdminCouponsPage() {
  const utils = trpc.useUtils()
  const { data: coupons, isLoading } = trpc.coupons.list.useQuery()

  const [form, setForm] = useState<FormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    code: string
  } | null>(null)

  const set = (patch: Partial<FormState>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))

  const invalidate = () => utils.coupons.list.invalidate()

  const create = trpc.coupons.create.useMutation({
    onSuccess: () => {
      invalidate()
      setForm(null)
      toast.success("Coupon created")
    },
    onError: (e) => toast.error(e.message),
  })
  const update = trpc.coupons.update.useMutation({
    onSuccess: () => {
      invalidate()
      setForm(null)
      toast.success("Coupon updated")
    },
    onError: (e) => toast.error(e.message),
  })
  const setEnabled = trpc.coupons.setEnabled.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  })
  const del = trpc.coupons.delete.useMutation({
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
      toast.success("Coupon deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const openNew = () => setForm({ ...EMPTY_FORM })
  const openEdit = (c: Coupon) => setForm(couponToForm(c))

  const has = (t: CondType) => !!form?.conditions.includes(t)
  const addCondition = (t: CondType) =>
    set({ conditions: [...(form?.conditions ?? []), t] })
  const removeCondition = (t: CondType) =>
    set({ conditions: (form?.conditions ?? []).filter((c) => c !== t) })

  const availableConditions = CONDITION_ORDER.filter(
    (t) => !form?.conditions.includes(t),
  )

  const submit = () => {
    if (!form) return
    const code = form.code.trim()
    if (code.length < 2) {
      toast.error("Enter a coupon code (at least 2 characters).")
      return
    }
    const value = parseFloat(form.discountValue)
    if (!value || value <= 0) {
      toast.error("Enter a discount value greater than 0.")
      return
    }
    if (form.discountType === "percent" && value > 100) {
      toast.error("A percentage discount can't exceed 100%.")
      return
    }
    const num = (s: string) => {
      const n = parseFloat(s)
      return isNaN(n) ? null : n
    }
    const int = (s: string) => {
      const n = parseInt(s, 10)
      return isNaN(n) ? null : n
    }
    // Validate each active condition has a value.
    if (has("min_subtotal") && num(form.minSubtotal) == null)
      return toast.error("Set a minimum order amount or remove that condition.")
    if (has("max_discount") && num(form.maxDiscount) == null)
      return toast.error("Set a maximum discount or remove that condition.")
    if (has("usage_limit") && int(form.usageLimit) == null)
      return toast.error("Set a total usage limit or remove that condition.")
    if (has("per_user_limit") && int(form.perUserLimit) == null)
      return toast.error("Set a per-customer limit or remove that condition.")
    if (has("starts_at") && !form.startsAt)
      return toast.error("Set a start date or remove that condition.")
    if (has("expires_at") && !form.expiresAt)
      return toast.error("Set an expiry date or remove that condition.")

    const payload = {
      code,
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: value,
      enabled: form.enabled,
      minSubtotal: has("min_subtotal") ? num(form.minSubtotal) : null,
      maxDiscount: has("max_discount") ? num(form.maxDiscount) : null,
      serviceType: has("service_type") ? form.serviceType : null,
      country: has("country") ? form.country : null,
      usageLimit: has("usage_limit") ? int(form.usageLimit) : null,
      perUserLimit: has("per_user_limit") ? int(form.perUserLimit) : null,
      firstOrderOnly: has("first_order_only"),
      startsAt: has("starts_at") ? new Date(form.startsAt) : null,
      expiresAt: has("expires_at") ? new Date(form.expiresAt) : null,
    }

    if (form.id) update.mutate({ id: form.id, ...payload })
    else create.mutate(payload)
  }

  const saving = create.isPending || update.isPending

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create discount codes customers can apply on any service payment.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon className="mr-1.5 size-4" />
          New coupon
        </Button>
      </div>

      {!coupons?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <TicketPercentIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No coupons yet.</p>
            <Button variant="outline" onClick={openNew}>
              <PlusIcon className="mr-1.5 size-4" />
              Create your first coupon
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coupons.map((c) => {
            const chips = conditionChips(c)
            return (
              <div
                key={c.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10">
                      <TicketPercentIcon className="size-5 text-sky-500" />
                    </div>
                    <div>
                      <p className="font-mono text-base font-bold uppercase text-foreground">
                        {c.code}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {discountLabel(c)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      c.enabled
                        ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground ring-border"
                    }`}
                  >
                    {c.enabled ? "Active" : "Disabled"}
                  </span>
                </div>

                {c.description && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {c.description}
                  </p>
                )}

                {chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chips.map((chip, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {c.redemptionCount}
                    </span>{" "}
                    redeemed
                    {c.usageLimit != null && ` / ${c.usageLimit}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        setEnabled.mutate({ id: c.id, enabled: !c.enabled })
                      }
                    >
                      {c.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(c)}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-red-500"
                      onClick={() =>
                        setDeleteTarget({ id: c.id, code: c.code })
                      }
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit coupon" : "New coupon"}</DialogTitle>
            <DialogDescription>
              Set the discount, then add any conditions that must be met for the
              coupon to apply.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Code</FieldLabel>
                  <FieldContent>
                    <Input
                      value={form.code}
                      onChange={(e) =>
                        set({ code: e.target.value.toUpperCase() })
                      }
                      placeholder="SAVE20"
                      className="font-mono uppercase"
                    />
                  </FieldContent>
                </Field>
                <label className="flex items-end gap-2 pb-2.5">
                  <Checkbox
                    checked={form.enabled}
                    onCheckedChange={(v) => set({ enabled: v === true })}
                  />
                  <span className="text-sm">Active (customers can use it)</span>
                </label>
              </div>

              <Field>
                <FieldLabel>Description (optional)</FieldLabel>
                <FieldContent>
                  <Textarea
                    className="min-h-16"
                    value={form.description}
                    onChange={(e) => set({ description: e.target.value })}
                    placeholder="Internal note or customer-facing summary…"
                  />
                </FieldContent>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Discount type</FieldLabel>
                  <FieldContent>
                    <Select
                      value={form.discountType}
                      onValueChange={(v) =>
                        set({ discountType: v as "percent" | "fixed" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>
                    {form.discountType === "percent"
                      ? "Percentage off"
                      : "Amount off (USD)"}
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.discountValue}
                      onChange={(e) => set({ discountValue: e.target.value })}
                      placeholder={form.discountType === "percent" ? "20" : "10"}
                    />
                  </FieldContent>
                </Field>
              </div>

              {/* Conditions builder */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Conditions</p>
                    <p className="text-xs text-muted-foreground">
                      All conditions must be satisfied for the coupon to apply.
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={availableConditions.length === 0}
                      >
                        <PlusIcon className="mr-1 size-4" />
                        Add condition
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {availableConditions.map((t) => (
                        <DropdownMenuItem
                          key={t}
                          onClick={() => addCondition(t)}
                        >
                          {CONDITION_META[t].label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {form.conditions.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    No conditions — this coupon applies to any service payment.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {CONDITION_ORDER.filter((t) =>
                      form.conditions.includes(t),
                    ).map((t) => (
                      <ConditionRow
                        key={t}
                        type={t}
                        form={form}
                        set={set}
                        onRemove={() => removeCondition(t)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving
                ? "Saving…"
                : form?.id
                  ? "Save changes"
                  : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete coupon"
        description={
          deleteTarget
            ? `Delete coupon "${deleteTarget.code}"? This can't be undone.`
            : ""
        }
        onConfirm={() => deleteTarget && del.mutate({ id: deleteTarget.id })}
        loading={del.isPending}
      />
    </div>
  )
}

function ConditionRow({
  type,
  form,
  set,
  onRemove,
}: {
  type: CondType
  form: FormState
  set: (patch: Partial<FormState>) => void
  onRemove: () => void
}) {
  const meta = CONDITION_META[type]
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{meta.desc}</p>
        </div>
        {type === "min_subtotal" && (
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.minSubtotal}
            onChange={(e) => set({ minSubtotal: e.target.value })}
            placeholder="e.g. 100"
          />
        )}
        {type === "max_discount" && (
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.maxDiscount}
            onChange={(e) => set({ maxDiscount: e.target.value })}
            placeholder="e.g. 50"
          />
        )}
        {type === "service_type" && (
          <Select
            value={form.serviceType}
            onValueChange={(v) =>
              set({ serviceType: v as "general" | "wordpress" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General services</SelectItem>
              <SelectItem value="wordpress">WordPress services</SelectItem>
            </SelectContent>
          </Select>
        )}
        {type === "country" && (
          <Select
            value={form.country}
            onValueChange={(v) => set({ country: v as "uk" | "us" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="us">United States</SelectItem>
            </SelectContent>
          </Select>
        )}
        {type === "usage_limit" && (
          <Input
            type="number"
            min={1}
            step="1"
            value={form.usageLimit}
            onChange={(e) => set({ usageLimit: e.target.value })}
            placeholder="e.g. 100"
          />
        )}
        {type === "per_user_limit" && (
          <Input
            type="number"
            min={1}
            step="1"
            value={form.perUserLimit}
            onChange={(e) => set({ perUserLimit: e.target.value })}
            placeholder="e.g. 1"
          />
        )}
        {type === "starts_at" && (
          <Input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
          />
        )}
        {type === "expires_at" && (
          <Input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => set({ expiresAt: e.target.value })}
          />
        )}
        {type === "first_order_only" && (
          <p className="text-xs italic text-muted-foreground">
            No value needed — applies only to a customer&apos;s first payment.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-red-500"
        title="Remove condition"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}
