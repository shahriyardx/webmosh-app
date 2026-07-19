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
  ArrowUpRightIcon,
  CheckIcon,
  PlusIcon,
  FileTextIcon,
  StarIcon,
  DollarSignIcon,
  WalletIcon,
  HourglassIcon,
  type LucideIcon,
} from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  unpaid: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.unpaid
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  )
}

const COMPANY_COLORS = [
  { bg: "bg-rose-500/15", text: "text-rose-500" },
  { bg: "bg-orange-500/15", text: "text-orange-500" },
  { bg: "bg-amber-500/15", text: "text-amber-500" },
  { bg: "bg-emerald-500/15", text: "text-emerald-500" },
  { bg: "bg-teal-500/15", text: "text-teal-500" },
  { bg: "bg-cyan-500/15", text: "text-cyan-500" },
  { bg: "bg-blue-500/15", text: "text-blue-500" },
  { bg: "bg-indigo-500/15", text: "text-indigo-500" },
  { bg: "bg-violet-500/15", text: "text-violet-500" },
  { bg: "bg-purple-500/15", text: "text-purple-500" },
  { bg: "bg-pink-500/15", text: "text-pink-500" },
  { bg: "bg-sky-500/15", text: "text-sky-500" },
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

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
      <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      {children}
    </CardTitle>
  )
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
  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()

  const user = session?.user
  const firstName = user?.name?.split(" ")[0] ?? "there"
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

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
    .filter(
      (s) =>
        s.type === "wordpress" ||
        (userCountries.size > 0
          ? s.country && userCountries.has(s.country)
          : true),
    )
    .slice(0, 3)

  const stats: {
    label: string
    value: string | number
    icon: LucideIcon
    href: string
    linkLabel: string
  }[] = [
    {
      label: "Companies",
      value: companies?.length ?? 0,
      icon: Building2Icon,
      href: "/companies",
      linkLabel: "View all companies",
    },
    {
      label: "Open orders",
      value: openOrders.length,
      icon: ShoppingCartIcon,
      href: "/account/orders",
      linkLabel: "View all orders",
    },
    {
      label: "Open tickets",
      value: openTicketsCount ?? 0,
      icon: LifeBuoyIcon,
      href: "/account/tickets",
      linkLabel: "Go to support",
    },
    {
      label: "Total paid",
      value: `$${totalPaid.toLocaleString()}`,
      icon: ReceiptIcon,
      href: "/account/invoices",
      linkLabel: "View payments",
    },
  ]

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
            {today}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {firstName} <span className="ml-1">👋</span>
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/account/services">
              <ConciergeBellIcon className="size-4" />
              Browse services
            </Link>
          </Button>
          <Button asChild>
            <Link href="/onboard">
              <PlusIcon className="size-4" />
              New company
            </Link>
          </Button>
        </div>
      </div>

      {/* Wallet hero */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <WalletIcon className="size-4" />
              Wallet balance
            </p>
            <p className="mt-2 text-5xl font-bold tracking-tight">
              ${(walletBalance?.available ?? 0).toFixed(2)}
              <span className="ml-2 text-base font-medium text-slate-400">
                USD
              </span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(walletBalance?.pendingTopup ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20">
                  <HourglassIcon className="size-3" />$
                  {walletBalance!.pendingTopup.toFixed(2)} awaiting verification
                </span>
              )}
              {(walletBalance?.spent ?? 0) > 0 && (
                <span className="text-xs text-slate-400">
                  ${walletBalance!.spent.toFixed(2)} spent on invoices
                </span>
              )}
              {!walletBalance?.pendingTopup && !walletBalance?.spent && (
                <span className="text-xs text-slate-400">
                  Top up once, pay invoices instantly.
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <Button
              asChild
              className="bg-white text-slate-900 shadow-none hover:bg-slate-200"
            >
              <Link href="/account/wallet">
                <PlusIcon className="size-4" />
                Add money
              </Link>
            </Button>
            <Button
              asChild
              className="border border-white/15 bg-white/5 text-white shadow-none backdrop-blur hover:bg-white/15"
            >
              <Link href="/account/wallet">
                Open wallet
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="group bg-card p-5 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </p>
                <s.icon className="size-4 text-muted-foreground/50 transition-colors group-hover:text-sky-500" />
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {s.value}
              </p>
              <p className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-sky-500">
                {s.linkLabel}
                <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Account + companies */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="rounded-2xl shadow-none">
          <CardHeader>
            <SectionTitle icon={UserIcon}>Account overview</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-lg font-semibold text-white ring-2 ring-sky-500/20 ring-offset-2 ring-offset-background">
                {initials(user?.name ?? "?")}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">
                  {user?.name ?? "—"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="space-y-3 border-t border-border pt-4">
              {user?.createdAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CalendarIcon className="size-3.5" />
                    Member since
                  </span>
                  <span className="font-medium">
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <WalletIcon className="size-3.5" />
                  Wallet
                </span>
                <Link
                  href="/account/wallet"
                  className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  ${(walletBalance?.available ?? 0).toFixed(2)}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <SectionTitle icon={Building2Icon}>Your companies</SectionTitle>
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
                    className={`group flex w-full items-center gap-4 rounded-xl border p-3.5 text-left transition-all hover:border-sky-500/40 hover:bg-muted/30 ${
                      needsAction
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-border"
                    }`}
                  >
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color.bg}`}
                    >
                      <span className={`text-sm font-bold ${color.text}`}>
                        {initials(c.name)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold uppercase tracking-wide">
                          {c.name}
                        </p>
                        {needsAction && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500 ring-1 ring-inset ring-red-500/20">
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
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders + mail */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <SectionTitle icon={ShoppingCartIcon}>Recent orders</SectionTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/account/orders">
                View all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentOrders.length ? (
              <EmptyRow
                icon={ShoppingCartIcon}
                message="No orders yet."
                actionLabel="Browse Services"
                actionHref="/account/services"
              />
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map((o) => {
                  const inv = o.invoice
                  return (
                    <Link
                      key={o.id}
                      href={`/account/orders/${o.id}`}
                      className="group flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                          {o.service?.title ?? "Service"}
                        </p>
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                          {o.organization?.name ?? "—"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {inv && <StatusPill status={inv.status} />}
                        <span className="w-14 text-right text-sm font-bold tabular-nums">
                          ${inv?.amount ?? "—"}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <SectionTitle icon={MailIcon}>Recent mail</SectionTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/account/mail">
                View all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentMails.length ? (
              <EmptyRow
                icon={MailIcon}
                message="No mail yet."
                description="We'll notify you when you receive new messages."
              />
            ) : (
              <div className="divide-y divide-border">
                {recentMails.map((m) => (
                  <Link
                    key={m.id}
                    href="/account/mail"
                    className="group flex items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!m.read && (
                          <span className="size-2 shrink-0 rounded-full bg-sky-500" />
                        )}
                        <p
                          className={`truncate text-sm transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400 ${
                            m.read ? "" : "font-semibold"
                          }`}
                        >
                          {m.subject}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">
                          {m.organization?.name ?? "—"}
                        </span>{" "}
                        · {m.from}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payments */}
      <Card className="rounded-2xl shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <SectionTitle icon={DollarSignIcon}>Recent payments</SectionTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/account/invoices">
              View all
              <ArrowRightIcon className="size-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!recentInvoices.length ? (
            <EmptyRow icon={ReceiptIcon} message="No payments yet." />
          ) : (
            <div className="divide-y divide-border">
              {recentInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/account/invoices/${inv.id}`}
                  className="group flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                      <ReceiptIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold tabular-nums transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        ${inv.amount}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">
                          {inv.organization?.name ?? "—"}
                        </span>{" "}
                        · {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={inv.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended */}
      {recommended.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
                <StarIcon className="size-4 fill-amber-500 text-amber-500" />
              </div>
              <h2 className="text-base font-semibold">Recommended for you</h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/account/services">
                Browse all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((svc) => (
              <Link
                key={svc.id}
                href="/account/services"
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-sky-500/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10">
                    <ConciergeBellIcon className="size-5 text-sky-500" />
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {svc.country ?? "Global"}
                  </span>
                </div>
                <p className="mt-3.5 text-sm font-semibold transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                  {svc.title}
                </p>
                {svc.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {svc.description}
                  </p>
                )}
                {svc.features?.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {svc.features.slice(0, 2).map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <CheckIcon className="size-3 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                  <span className="text-base font-bold">${svc.price}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-sky-500">
                    Order now
                    <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
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
    <div className="hidden items-center gap-2 sm:flex">
      <Icon
        className={`size-4 shrink-0 ${
          isUrgent ? "text-red-500" : "text-muted-foreground"
        }`}
      />
      <div className="text-left leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`text-xs font-semibold ${
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
      <div className="mb-1 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
        <Icon className="size-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Button size="sm" variant="outline" asChild className="mt-2">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}
