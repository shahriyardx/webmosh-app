"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  UserIcon,
  CalendarIcon,
  Building2Icon,
  ReceiptIcon,
  MailIcon,
  ShoppingCartIcon,
  ConciergeBellIcon,
  LifeBuoyIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  FileTextIcon,
  StarIcon,
  DollarSignIcon,
  type LucideIcon,
} from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  unpaid: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  processing: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  rejected: "bg-red-500/15 text-red-500 ring-red-500/25",
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.unpaid
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  )
}

type StatColor = "blue" | "emerald" | "violet" | "cyan"

const STAT_COLORS: Record<StatColor, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-500" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-500" },
}

const COMPANY_COLORS = [
  { bg: "bg-rose-500/20", text: "text-rose-400" },
  { bg: "bg-orange-500/20", text: "text-orange-400" },
  { bg: "bg-amber-500/20", text: "text-amber-400" },
  { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  { bg: "bg-teal-500/20", text: "text-teal-400" },
  { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  { bg: "bg-blue-500/20", text: "text-blue-400" },
  { bg: "bg-indigo-500/20", text: "text-indigo-400" },
  { bg: "bg-violet-500/20", text: "text-violet-400" },
  { bg: "bg-purple-500/20", text: "text-purple-400" },
  { bg: "bg-pink-500/20", text: "text-pink-400" },
  { bg: "bg-sky-500/20", text: "text-sky-400" },
]

function companyColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) & 0xffff
  }
  return COMPANY_COLORS[hash % COMPANY_COLORS.length]
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((w) => w[0]?.toUpperCase() ?? "").join("")
  return letters || "?"
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { data: allCompanies } = trpc.companies.myCompanies.useQuery()
  // "Companies" section shows real companies only — personal accounts are
  // represented by the Account overview card.
  const companies = allCompanies?.filter((c) => c.type !== "personal")
  const { data: invoices } = trpc.invoices.listForUser.useQuery()
  const { data: orders } = trpc.serviceOrders.listForUser.useQuery()
  const { data: mails } = trpc.mails.listForUser.useQuery()
  const { data: services } = trpc.services.list.useQuery()
  const { data: openTicketsCount } = trpc.tickets.openCount.useQuery()

  const user = session?.user
  const firstName = user?.name?.split(" ")[0] ?? "there"

  const totalPaid = (invoices ?? [])
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0)
  const openOrders = (orders ?? []).filter((o) => o.status !== "completed")

  const recentOrders = (orders ?? []).slice(0, 4)
  const recentInvoices = (invoices ?? []).slice(0, 4)
  const recentMails = (mails ?? []).slice(0, 4)

  const userCountries = new Set(
    (companies ?? [])
      .filter((c) => c.type !== "personal" && c.country)
      .map((c) => c.country as string),
  )
  const recommended = (services ?? [])
    .filter((s) => (userCountries.size > 0 ? userCountries.has(s.country) : true))
    .slice(0, 3)

  const stats: {
    label: string
    value: string | number
    icon: LucideIcon
    href: string
    color: StatColor
    linkLabel: string
  }[] = [
    {
      label: "Companies",
      value: companies?.length ?? 0,
      icon: Building2Icon,
      href: "/companies",
      color: "blue",
      linkLabel: "View all companies",
    },
    {
      label: "Open orders",
      value: openOrders.length,
      icon: ShoppingCartIcon,
      href: "/account/orders",
      color: "emerald",
      linkLabel: "View all orders",
    },
    {
      label: "Open tickets",
      value: openTicketsCount ?? 0,
      icon: LifeBuoyIcon,
      href: "/account/tickets",
      color: "violet",
      linkLabel: "Go to support",
    },
    {
      label: "Total paid",
      value: `$${totalPaid.toLocaleString()}`,
      icon: ReceiptIcon,
      href: "/account/invoices",
      color: "cyan",
      linkLabel: "View payments",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back, {firstName} <span className="ml-1">👋</span>
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const c = STAT_COLORS[s.color]
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group flex flex-col rounded-2xl border border-border p-5 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${c.bg}`}
                >
                  <s.icon className={`size-6 ${c.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-3xl font-bold leading-none text-foreground">
                    {s.value}
                  </p>
                  <p className="mt-1.5 text-base text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-sky-500">
                {s.linkLabel}
                <ArrowRightIcon className="size-3" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10">
                <UserIcon className="size-4 text-sky-500" />
              </div>
              Account overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-sky-500 text-lg font-semibold text-white">
                {initials(user?.name ?? "?")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-medium">
                  {user?.name ?? "—"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
            {user?.createdAt && (
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member since</p>
                  <p className="text-base font-medium">
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10">
                <Building2Icon className="size-4 text-sky-500" />
              </div>
              Your companies
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/onboard">
                  <PlusIcon className="size-3" />
                  Add company
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/companies">
                  View all
                  <ArrowRightIcon className="size-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!companies?.length ? (
              <EmptyRow
                icon={Building2Icon}
                message="No companies yet."
                actionLabel="Create Company"
                actionHref="/onboard"
              />
            ) : (
              companies.slice(0, 4).map((c) => {
                const csDate = c.confirmationStatementDue
                  ? new Date(c.confirmationStatementDue)
                  : null
                const accDate = c.accountsFilingDue
                  ? new Date(c.accountsFilingDue)
                  : null
                const csDue = csDate
                  ? csDate.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null
                const accDue = accDate
                  ? accDate.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null
                const csUrgency = getDueUrgency(csDate)
                const accUrgency = getDueUrgency(accDate)
                const needsAction =
                  csUrgency === "urgent" || accUrgency === "urgent"
                const color = companyColor(c.name)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/companies/${c.id}/overview`)}
                    className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 ${
                      needsAction
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-border"
                    }`}
                  >
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${color.bg}`}
                    >
                      <span className={`text-base font-bold ${color.text}`}>
                        {initials(c.name)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold uppercase">
                          {c.name}
                        </p>
                        {needsAction && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-500/15 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-red-500">
                            Take action
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {c.type === "personal"
                          ? "Personal Account"
                          : c.country === "uk"
                            ? "United Kingdom"
                            : "United States"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-5">
                      {csDue && (
                        <DateColumn
                          label="Confirmation"
                          value={csDue}
                          icon={CalendarIcon}
                          urgency={csUrgency}
                        />
                      )}
                      {accDue && (
                        <DateColumn
                          label="Accounts"
                          value={accDue}
                          icon={FileTextIcon}
                          urgency={accUrgency}
                        />
                      )}
                      <ArrowRightIcon className="size-4 text-muted-foreground" />
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10">
                <ShoppingCartIcon className="size-4 text-sky-500" />
              </div>
              Recent orders
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/account/orders">
                View all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!recentOrders.length ? (
              <EmptyRow
                icon={ShoppingCartIcon}
                message="No orders yet."
                actionLabel="Browse Services"
                actionHref="/account/services"
              />
            ) : (
              recentOrders.map((o) => {
                const inv = o.invoice
                return (
                  <Link
                    key={o.id}
                    href={`/account/orders/${o.id}`}
                    className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium">
                        {o.service?.title ?? "Service"}
                      </p>
                      <p className="mt-0.5 text-sm uppercase text-muted-foreground">
                        {o.organization?.name ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {inv && <StatusPill status={inv.status} />}
                      <span className="text-base font-semibold">
                        ${inv?.amount ?? "—"}
                      </span>
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10">
                <MailIcon className="size-4 text-sky-500" />
              </div>
              Recent mail
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/account/mail">
                View all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!recentMails.length ? (
              <EmptyRow
                icon={MailIcon}
                message="No mail yet."
                description="We'll notify you when you receive new messages."
              />
            ) : (
              recentMails.map((m) => (
                <Link
                  key={m.id}
                  href="/account/mail"
                  className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!m.read && (
                        <span className="size-2 shrink-0 rounded-full bg-sky-500" />
                      )}
                      <p
                        className={`truncate text-base ${m.read ? "" : "font-semibold"}`}
                      >
                        {m.subject}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      <span className="uppercase">
                        {m.organization?.name ?? "—"}
                      </span>{" "}
                      · {m.from}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10">
              <DollarSignIcon className="size-4 text-sky-500" />
            </div>
            Recent payments
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/account/invoices">
              View all
              <ArrowRightIcon className="size-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {!recentInvoices.length ? (
            <EmptyRow icon={ReceiptIcon} message="No payments yet." />
          ) : (
            recentInvoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/account/invoices/${inv.id}`}
                className="flex items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold">${inv.amount}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    <span className="uppercase">
                      {inv.organization?.name ?? "—"}
                    </span>{" "}
                    · {new Date(inv.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill status={inv.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {recommended.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10">
                <StarIcon className="size-4 fill-amber-500 text-amber-500" />
              </div>
              Recommended services
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/account/services">
                Browse all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((svc) => (
              <Link
                key={svc.id}
                href="/account/services"
                className="flex flex-col rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-cyan-500/10">
                  <ConciergeBellIcon className="size-5 text-cyan-500" />
                </div>
                <p className="text-base font-semibold">{svc.title}</p>
                {svc.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {svc.description}
                  </p>
                )}
                {svc.features?.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {svc.features.slice(0, 2).map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground"
                      >
                        <CheckIcon className="size-3 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-base font-bold">${svc.price}</span>
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                    {svc.country}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

type DueUrgency = "urgent" | "soon" | "normal"

function getDueUrgency(date: Date | null): DueUrgency {
  if (!date) return "normal"
  const days = Math.floor(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (days <= 30) return "urgent"
  if (days <= 60) return "soon"
  return "normal"
}

function DateColumn({
  label,
  value,
  icon: Icon,
  urgency,
}: {
  label: string
  value: string
  icon: LucideIcon
  urgency: DueUrgency
}) {
  const isUrgent = urgency === "urgent"
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={`size-4 shrink-0 ${
          isUrgent ? "text-red-500" : "text-muted-foreground"
        }`}
      />
      <div className="text-left leading-tight">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-sm font-semibold ${
            isUrgent ? "text-red-500" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function EmptyRow({
  icon: Icon,
  message,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ComponentType<{ className?: string }>
  message: string
  description?: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-sky-500/10">
        <Icon className="size-7 text-sky-500/70" />
      </div>
      <p className="text-base font-medium text-foreground">{message}</p>
      {description && (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Button size="sm" variant="outline" asChild className="mt-2">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}
