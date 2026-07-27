"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ServiceOrderStatus } from "@/generated/prisma/enums"
import {
  SaveIcon,
  SlidersHorizontalIcon,
  PaletteIcon,
  GlobeIcon,
  KeyRoundIcon,
} from "lucide-react"

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </p>
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
    <div className="space-y-1">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

type CredentialSection = { url?: string; username?: string; password?: string }
type OrderCredentials = { cpanel?: CredentialSection; wpAdmin?: CredentialSection }

export type EditableOrder = {
  id: string
  status: string
  customDesignUrl: string | null
  themeId: string | null
  theme?: { id: string; title: string } | null
  contactCompany: string | null
  contactAddress: string | null
  contactEmail: string | null
  contactPhone: string | null
  credentials: unknown
  invoice?: { id: string; number: number; amount: number; status: string } | null
}

const STATUS_OPTIONS: { value: ServiceOrderStatus; label: string }[] = [
  { value: ServiceOrderStatus.pending, label: "Pending" },
  { value: ServiceOrderStatus.processing, label: "Processing" },
  { value: ServiceOrderStatus.completed, label: "Completed" },
  { value: ServiceOrderStatus.awaiting_quote, label: "Awaiting quote" },
]

const EMPTY_CREDS: OrderCredentials = {
  cpanel: { url: "", username: "", password: "" },
  wpAdmin: { url: "", username: "", password: "" },
}

export function OrderDetailsEditor({
  order,
  onSaved,
}: {
  order: EditableOrder
  onSaved?: () => void
}) {
  const { data: themes } = trpc.themes.list.useQuery()

  const [status, setStatus] = useState<ServiceOrderStatus>(
    ServiceOrderStatus.pending,
  )
  const [amount, setAmount] = useState("")
  const [designMode, setDesignMode] = useState<"theme" | "custom">("theme")
  const [themeId, setThemeId] = useState("")
  const [customDesignUrl, setCustomDesignUrl] = useState("")
  const [contact, setContact] = useState({
    company: "",
    email: "",
    phone: "",
    address: "",
  })
  const [creds, setCreds] = useState<OrderCredentials>(EMPTY_CREDS)

  useEffect(() => {
    setStatus(order.status as ServiceOrderStatus)
    setAmount(order.invoice?.amount != null ? String(order.invoice.amount) : "")
    setDesignMode(order.customDesignUrl ? "custom" : "theme")
    setThemeId(order.themeId ?? "")
    setCustomDesignUrl(order.customDesignUrl ?? "")
    setContact({
      company: order.contactCompany ?? "",
      email: order.contactEmail ?? "",
      phone: order.contactPhone ?? "",
      address: order.contactAddress ?? "",
    })
    const c = (order.credentials as OrderCredentials | null) ?? null
    setCreds({
      cpanel: {
        url: c?.cpanel?.url ?? "",
        username: c?.cpanel?.username ?? "",
        password: c?.cpanel?.password ?? "",
      },
      wpAdmin: {
        url: c?.wpAdmin?.url ?? "",
        username: c?.wpAdmin?.username ?? "",
        password: c?.wpAdmin?.password ?? "",
      },
    })
  }, [order])

  const update = trpc.serviceOrders.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("Order details saved")
      onSaved?.()
    },
    onError: (err) => toast.error(err.message),
  })

  const save = () => {
    const patch: Parameters<typeof update.mutate>[0] = { id: order.id, status }
    if (order.invoice) {
      const n = parseFloat(amount)
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Enter a valid invoice amount")
        return
      }
      patch.amount = n
    }
    if (designMode === "theme") {
      patch.themeId = themeId || null
      patch.customDesignUrl = null
    } else {
      patch.customDesignUrl = customDesignUrl.trim() || null
      patch.themeId = null
    }
    patch.contactCompany = contact.company.trim() || null
    patch.contactEmail = contact.email.trim() || null
    patch.contactPhone = contact.phone.trim() || null
    patch.contactAddress = contact.address.trim() || null
    patch.credentials = creds
    update.mutate(patch)
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-muted/20 p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
            <SlidersHorizontalIcon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Order details</p>
            <p className="text-xs text-muted-foreground">
              Review &amp; edit before assigning.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={save}
          disabled={update.isPending}
        >
          <SaveIcon className="size-3.5" />
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel>Order status</FieldLabel>
          <FieldContent>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ServiceOrderStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
        {order.invoice && (
          <Field>
            <FieldLabel>Invoice #{order.invoice.number} (USD)</FieldLabel>
            <FieldContent>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FieldContent>
          </Field>
        )}
      </div>

      {/* Design */}
      <section className="space-y-2.5">
        <SectionLabel icon={PaletteIcon}>Design</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDesignMode("theme")}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              designMode === "theme"
                ? "border-sky-500 bg-sky-500/5 font-medium ring-1 ring-sky-500/30"
                : "border-border hover:bg-muted/40"
            }`}
          >
            Demo theme
          </button>
          <button
            type="button"
            onClick={() => setDesignMode("custom")}
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
              designMode === "custom"
                ? "border-sky-500 bg-sky-500/5 font-medium ring-1 ring-sky-500/30"
                : "border-border hover:bg-muted/40"
            }`}
          >
            Custom design
          </button>
        </div>
        {designMode === "theme" ? (
          <Select
            value={themeId || "none"}
            onValueChange={(v) => setThemeId(v === "none" ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No theme</SelectItem>
              {(themes ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="https://figma.com/… or design URL"
            value={customDesignUrl}
            onChange={(e) => setCustomDesignUrl(e.target.value)}
          />
        )}
      </section>

      {/* Website details */}
      <section className="space-y-2.5">
        <SectionLabel icon={GlobeIcon}>Website details</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label="Company">
            <Input
              value={contact.company}
              onChange={(e) =>
                setContact({ ...contact, company: e.target.value })
              }
            />
          </Labeled>
          <Labeled label="Email">
            <Input
              value={contact.email}
              onChange={(e) =>
                setContact({ ...contact, email: e.target.value })
              }
            />
          </Labeled>
          <Labeled label="Phone">
            <Input
              value={contact.phone}
              onChange={(e) =>
                setContact({ ...contact, phone: e.target.value })
              }
            />
          </Labeled>
          <Labeled label="Address">
            <Input
              value={contact.address}
              onChange={(e) =>
                setContact({ ...contact, address: e.target.value })
              }
            />
          </Labeled>
        </div>
      </section>

      {/* Hosting access */}
      <section className="space-y-3">
        <SectionLabel icon={KeyRoundIcon}>Hosting access</SectionLabel>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            cPanel
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Labeled label="URL">
              <Input
                value={creds.cpanel?.url ?? ""}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    cpanel: { ...creds.cpanel, url: e.target.value },
                  })
                }
              />
            </Labeled>
            <Labeled label="Username">
              <Input
                value={creds.cpanel?.username ?? ""}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    cpanel: { ...creds.cpanel, username: e.target.value },
                  })
                }
              />
            </Labeled>
            <Labeled label="Password">
              <Input
                value={creds.cpanel?.password ?? ""}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    cpanel: { ...creds.cpanel, password: e.target.value },
                  })
                }
              />
            </Labeled>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            WP-admin
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Labeled label="URL">
              <Input
                value={creds.wpAdmin?.url ?? ""}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    wpAdmin: { ...creds.wpAdmin, url: e.target.value },
                  })
                }
              />
            </Labeled>
            <Labeled label="Username">
              <Input
                value={creds.wpAdmin?.username ?? ""}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    wpAdmin: { ...creds.wpAdmin, username: e.target.value },
                  })
                }
              />
            </Labeled>
            <Labeled label="Password">
              <Input
                value={creds.wpAdmin?.password ?? ""}
                onChange={(e) =>
                  setCreds({
                    ...creds,
                    wpAdmin: { ...creds.wpAdmin, password: e.target.value },
                  })
                }
              />
            </Labeled>
          </div>
        </div>
      </section>
    </div>
  )
}
