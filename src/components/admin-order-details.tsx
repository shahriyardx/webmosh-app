"use client"

import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Badge } from "@/components/ui/badge"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import {
  ExternalLinkIcon,
  PaletteIcon,
  GlobeIcon,
  KeyRoundIcon,
  MonitorIcon,
  ClipboardListIcon,
} from "lucide-react"

export type AdminOrder =
  inferRouterOutputs<AppRouter>["serviceOrders"]["listAll"][number]

type CredentialSection = { url?: string; username?: string; password?: string }
type OrderCredentials = { cpanel?: CredentialSection; wpAdmin?: CredentialSection }

const statusBadge: Record<
  string,
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  awaiting_quote: { label: "Awaiting quote", variant: "destructive" },
}

function hasCred(s?: CredentialSection) {
  return !!s && (!!s.url || !!s.username || !!s.password)
}

function KV({
  label,
  value,
  mono,
}: {
  label: string
  value?: string | null
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 break-words text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </p>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="size-3.5 text-sky-500" />
        {title}
      </p>
      {children}
    </div>
  )
}

function CredCard({
  label,
  section,
}: {
  label: string
  section?: CredentialSection
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {!hasCred(section) ? (
        <p className="text-sm text-muted-foreground">Not provided.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <KV label="URL" value={section?.url} mono />
          <KV label="Username" value={section?.username} mono />
          <KV label="Password" value={section?.password} mono />
        </div>
      )}
    </div>
  )
}

export function AdminOrderDetails({ order }: { order: AdminOrder }) {
  const creds = (order.credentials as OrderCredentials | null) ?? null
  const isWordpress = order.service?.type === "wordpress"
  const sb = statusBadge[order.status] ?? statusBadge.pending
  const hasContact = !!(
    order.contactCompany ||
    order.contactEmail ||
    order.contactPhone ||
    order.contactAddress
  )
  const hasHosting = hasCred(creds?.cpanel) || hasCred(creds?.wpAdmin)
  const requiresRdp = order.service?.requiresRdp
  const hasRdp = !!(
    order.rdpHost ||
    order.rdpUsername ||
    order.rdpPassword ||
    order.rdpPort
  )

  const stats: { label: string; value?: string; node?: React.ReactNode; mono?: boolean }[] = [
    {
      label: "Company",
      value: order.organization?.name ?? order.contactCompany ?? "—",
    },
    {
      label: "Amount",
      value: order.invoice?.amount != null ? `$${order.invoice.amount}` : "—",
    },
    { label: "Order status", node: <Badge variant={sb.variant}>{sb.label}</Badge> },
    {
      label: "Invoice",
      mono: true,
      value:
        order.invoice?.number != null
          ? formatInvoiceNumber(order.invoice.number)
          : "—",
    },
    {
      label: "Invoice status",
      node: order.invoice?.status ? (
        <span className="text-sm capitalize">{order.invoice.status}</span>
      ) : (
        "—"
      ),
    },
    { label: "Placed", value: new Date(order.createdAt).toLocaleDateString() },
  ]

  return (
    <div className="space-y-4">
      {/* Summary — hairline stat strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <div className="mt-1 truncate text-sm font-medium">
              {s.node ?? (
                <span className={s.mono ? "font-mono text-xs" : ""}>
                  {s.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isWordpress && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Design */}
          <Section icon={PaletteIcon} title="Design">
            {order.customDesignUrl ? (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Custom design
                </p>
                <a
                  href={order.customDesignUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 break-all text-sm text-sky-500 hover:underline"
                >
                  {order.customDesignUrl}
                  <ExternalLinkIcon className="size-3 shrink-0" />
                </a>
              </div>
            ) : order.theme ? (
              <div className="flex items-center gap-3">
                {order.theme.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.theme.image}
                    alt={order.theme.title}
                    className="h-16 w-24 shrink-0 rounded-lg border border-border object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Selected theme
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {order.theme.title}
                  </p>
                  {order.theme.demoUrl && (
                    <a
                      href={order.theme.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
                    >
                      View demo
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No design specified.</p>
            )}
          </Section>

          {/* Website details */}
          <Section icon={GlobeIcon} title="Website details">
            {!hasContact ? (
              <p className="text-sm text-muted-foreground">
                Not provided (older order).
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <KV label="Company" value={order.contactCompany} />
                <KV label="Email" value={order.contactEmail} />
                <KV label="Phone" value={order.contactPhone} />
                <KV label="Address" value={order.contactAddress} />
              </div>
            )}
          </Section>

          {/* Hosting access */}
          <Section
            icon={KeyRoundIcon}
            title="Hosting access"
            className="lg:col-span-2"
          >
            {!hasHosting ? (
              <p className="text-sm text-muted-foreground">
                No hosting credentials provided.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <CredCard label="cPanel" section={creds?.cpanel} />
                <CredCard label="WP-admin" section={creds?.wpAdmin} />
              </div>
            )}
          </Section>
        </div>
      )}

      {(requiresRdp || hasRdp) && (
        <Section icon={MonitorIcon} title="RDP access">
          {!hasRdp ? (
            <p className="text-sm text-muted-foreground">Not set yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KV label="Host / IP" value={order.rdpHost} mono />
              <KV label="Username" value={order.rdpUsername} mono />
              <KV label="Password" value={order.rdpPassword} mono />
            </div>
          )}
        </Section>
      )}

      {Array.isArray(order.requirementValues) &&
        order.requirementValues.length > 0 && (
          <Section icon={ClipboardListIcon} title="Requirements">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                order.requirementValues as unknown as {
                  label: string
                  value: string
                }[]
              ).map((r, i) => (
                <KV key={i} label={r.label} value={r.value} />
              ))}
            </div>
          </Section>
        )}
    </div>
  )
}
