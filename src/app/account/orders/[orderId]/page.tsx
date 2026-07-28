"use client"

import { use } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  CheckIcon,
  ExternalLinkIcon,
  ClockIcon,
  PaletteIcon,
  ReceiptIcon,
  MonitorIcon,
} from "lucide-react"

const TONES: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  muted: "bg-muted text-muted-foreground",
}

function StatusPill({ tone, label }: { tone: keyof typeof TONES; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}
    >
      {label}
    </span>
  )
}

const orderMeta: Record<string, { tone: keyof typeof TONES; label: string }> = {
  pending: { tone: "amber", label: "Pending" },
  processing: { tone: "sky", label: "In progress" },
  completed: { tone: "emerald", label: "Completed" },
  awaiting_quote: { tone: "amber", label: "Awaiting quote" },
}

const invMeta: Record<string, { tone: keyof typeof TONES; label: string }> = {
  unpaid: { tone: "amber", label: "Unpaid" },
  processing: { tone: "sky", label: "Processing" },
  paid: { tone: "emerald", label: "Paid" },
  partially_paid: { tone: "sky", label: "Partially paid" },
  rejected: { tone: "red", label: "Rejected" },
}

type CredSection = { url?: string; username?: string; password?: string }
type OrderCreds = { cpanel?: CredSection; wpAdmin?: CredSection }

function hasCred(s?: CredSection) {
  return !!s && (!!s.url || !!s.username || !!s.password)
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value?: string | null
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 break-words text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  )
}

function CredBlock({ label, section }: { label: string; section?: CredSection }) {
  if (!hasCred(section)) return null
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Detail label="URL" value={section?.url} mono />
        <Detail label="Username" value={section?.username} mono />
        <Detail label="Password" value={section?.password} mono />
      </dl>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

export default function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = use(params)
  const { data: order, isLoading } = trpc.serviceOrders.getById.useQuery({
    id: orderId,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </div>
    )
  }

  const inv = order.invoice
  const svc = order.service
  const os = orderMeta[order.status] ?? orderMeta.pending
  const st = inv ? invMeta[inv.status] ?? invMeta.unpaid : undefined
  const isWordpress = svc?.type === "wordpress"
  const payable = inv?.status === "unpaid" || inv?.status === "partially_paid"

  const creds = (order.credentials as OrderCreds | null) ?? null
  const hasDesign = !!(order.customDesignUrl || order.theme)
  const hasContact = !!(
    order.contactCompany ||
    order.contactEmail ||
    order.contactPhone ||
    order.contactAddress
  )
  const hasHosting = hasCred(creds?.cpanel) || hasCred(creds?.wpAdmin)
  const hasDetails = isWordpress && (hasDesign || hasContact || hasHosting)
  const hasRdp = !!(
    order.rdpHost ||
    order.rdpUsername ||
    order.rdpPassword ||
    order.rdpPort
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild className="size-9 shrink-0">
          <Link href="/account/orders">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Order</h1>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {order.id}
          </p>
        </div>
        <StatusPill tone={os.tone} label={os.label} />
      </div>

      {/* Service hero */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
            <ShoppingCartIcon className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Service
            </p>
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-semibold text-foreground">
                {svc?.title ?? "Unknown service"}
              </p>
              {isWordpress && (
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-500">
                  WordPress
                </span>
              )}
            </div>
          </div>
          {svc?.price != null && (
            <p className="shrink-0 text-2xl font-bold tabular-nums text-foreground">
              ${svc.price}
            </p>
          )}
        </div>
      </div>

      {/* Full order details */}
      {hasDetails && (
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <PaletteIcon className="size-4 text-sky-500" />
            <span className="text-sm font-semibold">Order details</span>
          </div>
          <div className="space-y-5 p-5">
            {/* Design */}
            {hasDesign && (
              <div className="space-y-2">
                <SectionLabel>Design</SectionLabel>
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
                  <div className="flex items-center gap-4">
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
                      <p className="mt-0.5 text-sm font-semibold">
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
                ) : null}
              </div>
            )}

            {/* Website details */}
            {hasContact && (
              <div className="space-y-2">
                <SectionLabel>Website details</SectionLabel>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Detail label="Company" value={order.contactCompany} />
                  <Detail label="Email" value={order.contactEmail} />
                  <Detail label="Phone" value={order.contactPhone} />
                  <Detail label="Address" value={order.contactAddress} />
                </dl>
              </div>
            )}

            {/* Hosting access */}
            {hasHosting && (
              <div className="space-y-2">
                <SectionLabel>Hosting access</SectionLabel>
                <div className="space-y-3">
                  <CredBlock label="cPanel" section={creds?.cpanel} />
                  <CredBlock label="WP-admin" section={creds?.wpAdmin} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RDP access */}
      {hasRdp && (
        <div className="rounded-2xl border border-border">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <MonitorIcon className="size-4 text-sky-500" />
            <span className="text-sm font-semibold">RDP access</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
            <Detail label="Host / IP" value={order.rdpHost} mono />
            <Detail label="Username" value={order.rdpUsername} mono />
            <Detail label="Password" value={order.rdpPassword} mono />
          </div>
        </div>
      )}

      {/* Payment */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ReceiptIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Payment</span>
          </div>
          {st && <StatusPill tone={st.tone} label={st.label} />}
        </div>

        {inv ? (
          <div className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total due
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-foreground">
              ${inv.amount}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Invoice {formatInvoiceNumber(inv.number)}
            </p>

            {payable ? (
              <Button asChild size="lg" className="mt-5 w-full">
                <Link href={`/account/invoices/${inv.id}`}>
                  <CheckIcon className="mr-1.5 size-4" />
                  {inv.status === "partially_paid"
                    ? "Continue payment"
                    : `Pay $${inv.amount}`}
                </Link>
              </Button>
            ) : inv.status === "paid" ? (
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="size-4" />
                This order is paid in full.
              </div>
            ) : (
              <Button asChild variant="outline" size="lg" className="mt-5 w-full">
                <Link href={`/account/invoices/${inv.id}`}>View invoice</Link>
              </Button>
            )}
          </div>
        ) : order.status === "awaiting_quote" ? (
          <div className="flex items-start gap-3 p-5">
            <ClockIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium">Awaiting quote</p>
              <p className="text-sm text-muted-foreground">
                Our team is reviewing your design. You&apos;ll receive an invoice
                by email once we&apos;ve prepared your custom quote.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              Payment isn&apos;t available for this order yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
