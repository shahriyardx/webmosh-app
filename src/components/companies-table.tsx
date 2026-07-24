"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  SearchIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from "lucide-react"

export type CompanyRow =
  inferRouterOutputs<AppRouter>["companies"]["myCompanies"][number]

export type AccountStatusValue =
  | "not_started"
  | "pending"
  | "active"
  | "rejected"
  | "closed"

/** A status the admin can set; "auto" clears a Website override. */
export type SetStatusValue = AccountStatusValue | "auto"

type SortKey =
  | "name"
  | "number"
  | "incorporation"
  | "status"
  | "accountsDue"
  | "statementDue"
  | "services"
  | "website"
  | "stripe"
  | "wise"

const PAGE_SIZE = 10

const ACCOUNT_OPTIONS: { value: AccountStatusValue; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
]

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB")
}

function statusLabel(c: CompanyRow) {
  if (c.chStatus) {
    return c.chStatus
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }
  return c.status.charAt(0).toUpperCase() + c.status.slice(1)
}

function isActive(c: CompanyRow) {
  if (c.chStatus) return c.chStatus === "active"
  return c.status === "completed"
}

function actionNeeded(c: CompanyRow) {
  const now = Date.now()
  const overdue = (d: Date | null | undefined) =>
    !!d && new Date(d).getTime() < now
  return overdue(c.accountsFilingDue) || overdue(c.confirmationStatementDue)
}

const PILL_STYLES: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  muted: "bg-muted text-muted-foreground",
}

function Pill({ tone, label }: { tone: keyof typeof PILL_STYLES; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PILL_STYLES[tone]}`}
    >
      {label}
    </span>
  )
}

function websiteMeta(s: string | null): { tone: keyof typeof PILL_STYLES; label: string } {
  switch (s) {
    case "completed":
      return { tone: "emerald", label: "Live" }
    case "processing":
      return { tone: "sky", label: "In progress" }
    case "pending":
      return { tone: "amber", label: "Pending" }
    case "awaiting_quote":
      return { tone: "amber", label: "Awaiting quote" }
    default:
      return { tone: "muted", label: "Not ordered" }
  }
}

function accountMeta(s: string): { tone: keyof typeof PILL_STYLES; label: string } {
  switch (s) {
    case "active":
      return { tone: "emerald", label: "Active" }
    case "pending":
      return { tone: "amber", label: "Pending" }
    case "rejected":
      return { tone: "red", label: "Rejected" }
    case "closed":
      return { tone: "slate", label: "Closed" }
    default:
      return { tone: "muted", label: "Not started" }
  }
}

/** Effective website status pill: an admin override wins over the order-derived status. */
function websiteEffectiveMeta(
  c: CompanyRow,
): { tone: keyof typeof PILL_STYLES; label: string } {
  if (c.websiteStatusOverride) return accountMeta(c.websiteStatusOverride)
  return websiteMeta(c.websiteStatus)
}

const rank = {
  active: 4,
  completed: 4,
  processing: 3,
  pending: 2,
  awaiting_quote: 2,
  rejected: 1,
  closed: 0,
} as Record<string, number>

export function CompaniesTable({
  companies,
  mode = "user",
  onSetStatus,
  pendingKey,
}: {
  companies: CompanyRow[]
  mode?: "user" | "admin"
  /** Admin only: change a company's Website/Stripe/Wise status. */
  onSetStatus?: (
    organizationId: string,
    field: "stripe" | "wise" | "website",
    status: SetStatusValue,
  ) => void
  /** Admin only: `${orgId}:${field}` currently saving. */
  pendingKey?: string | null
}) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.companyId ?? "").toLowerCase().includes(q),
    )
  }, [companies, search])

  // Strict active/closed totals: only explicitly Active or Closed items count.
  // A completed website order counts as Active unless the admin overrode it.
  const summary = useMemo(() => {
    const mk = () => ({ active: 0, closed: 0 })
    const website = mk()
    const stripe = mk()
    const wise = mk()
    const tally = (bucket: { active: number; closed: number }, s: string) => {
      if (s === "active") bucket.active++
      else if (s === "closed") bucket.closed++
    }
    for (const c of companies) {
      const web = c.websiteStatusOverride
        ? c.websiteStatusOverride
        : c.websiteStatus === "completed"
          ? "active"
          : ""
      tally(website, web)
      tally(stripe, c.stripeStatus)
      tally(wise, c.wiseStatus)
    }
    return { website, stripe, wise }
  }, [companies])

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1
    const time = (d: Date | null | undefined) =>
      d ? new Date(d).getTime() : sortDir === "asc" ? Infinity : -Infinity
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir
        case "number":
          return (a.companyId ?? "").localeCompare(b.companyId ?? "") * dir
        case "incorporation":
          return (time(a.incorporationDate) - time(b.incorporationDate)) * dir
        case "status":
          return statusLabel(a).localeCompare(statusLabel(b)) * dir
        case "accountsDue":
          return (time(a.accountsFilingDue) - time(b.accountsFilingDue)) * dir
        case "statementDue":
          return (
            (time(a.confirmationStatementDue) -
              time(b.confirmationStatementDue)) *
            dir
          )
        case "services":
          return (Number(actionNeeded(a)) - Number(actionNeeded(b))) * dir
        case "website":
          return (
            ((rank[a.websiteStatusOverride ?? a.websiteStatus ?? ""] ?? -1) -
              (rank[b.websiteStatusOverride ?? b.websiteStatus ?? ""] ?? -1)) *
            dir
          )
        case "stripe":
          return ((rank[a.stripeStatus] ?? -1) - (rank[b.stripeStatus] ?? -1)) * dir
        case "wise":
          return ((rank[a.wiseStatus] ?? -1) - (rank[b.wiseStatus] ?? -1)) * dir
        default:
          return 0
      }
    })
  }, [filtered, sortKey, sortDir])

  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * PAGE_SIZE
  const pageItems = sorted.slice(start, start + PAGE_SIZE)
  const showingFrom = total === 0 ? 0 : start + 1
  const showingTo = Math.min(start + PAGE_SIZE, total)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  const hrefFor = (c: CompanyRow) =>
    mode === "admin"
      ? `/admin/formations/${c.id}`
      : `/companies/${c.id}/overview`

  return (
    <div className="space-y-4">
      {/* Summary counters */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Website" counts={summary.website} />
        <SummaryCard label="Stripe" counts={summary.stripe} />
        <SummaryCard label="Wise" counts={summary.wise} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Search by name or company number…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[1180px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <SortHeader label="Company Name" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <SortHeader label="Company Number" active={sortKey === "number"} dir={sortDir} onClick={() => toggleSort("number")} />
              <SortHeader label="Incorporation Date" active={sortKey === "incorporation"} dir={sortDir} onClick={() => toggleSort("incorporation")} />
              <SortHeader label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
              <SortHeader label="Accounts Due" active={sortKey === "accountsDue"} dir={sortDir} onClick={() => toggleSort("accountsDue")} />
              <SortHeader label="Statement Due" active={sortKey === "statementDue"} dir={sortDir} onClick={() => toggleSort("statementDue")} />
              <SortHeader label="Website" active={sortKey === "website"} dir={sortDir} onClick={() => toggleSort("website")} />
              <SortHeader label="Stripe" active={sortKey === "stripe"} dir={sortDir} onClick={() => toggleSort("stripe")} />
              <SortHeader label="Wise" active={sortKey === "wise"} dir={sortDir} onClick={() => toggleSort("wise")} />
              <SortHeader label="My Services" active={sortKey === "services"} dir={sortDir} onClick={() => toggleSort("services")} />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => {
              const needsAction = actionNeeded(c)
              return (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={hrefFor(c)}
                      className="font-semibold uppercase tracking-wide text-foreground hover:text-sky-600 dark:hover:text-sky-400"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {c.companyId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(c.incorporationDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        isActive(c)
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isActive(c) ? "bg-emerald-500" : "bg-muted-foreground/50"
                        }`}
                      />
                      {statusLabel(c)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(c.accountsFilingDue)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {fmtDate(c.confirmationStatementDue)}
                  </td>
                  <td className="px-4 py-3">
                    <WebsiteCell
                      c={c}
                      mode={mode}
                      onSetStatus={onSetStatus}
                      pendingKey={pendingKey}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <AccountCell
                      c={c}
                      field="stripe"
                      value={c.stripeStatus}
                      mode={mode}
                      onSetStatus={onSetStatus}
                      pendingKey={pendingKey}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <AccountCell
                      c={c}
                      field="wise"
                      value={c.wiseStatus}
                      mode={mode}
                      onSetStatus={onSetStatus}
                      pendingKey={pendingKey}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {needsAction ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                        <AlertTriangleIcon className="size-4" />
                        Action needed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2Icon className="size-4" />
                        No action needed
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {pageItems.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No companies match &ldquo;{search}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Showing {showingFrom} to {showingTo} of {total}{" "}
          {total === 1 ? "entry" : "entries"}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={current <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === current ? "default" : "outline"}
                size="icon"
                className="size-8"
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  counts,
}: {
  label: string
  counts: { active: number; closed: number }
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-5">
        <div>
          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {counts.active}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Active
          </p>
        </div>
        <div className="h-9 w-px bg-border" />
        <div>
          <p className="text-2xl font-bold tabular-nums text-muted-foreground">
            {counts.closed}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            Closed
          </p>
        </div>
      </div>
    </div>
  )
}

type SetStatusFn = (
  organizationId: string,
  field: "stripe" | "wise" | "website",
  status: SetStatusValue,
) => void

const STATUS_SELECT_CLS =
  "rounded-md border border-border bg-background px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500/40 disabled:opacity-50"

function AccountCell({
  c,
  field,
  value,
  mode,
  onSetStatus,
  pendingKey,
}: {
  c: CompanyRow
  field: "stripe" | "wise"
  value: string
  mode: "user" | "admin"
  onSetStatus?: SetStatusFn
  pendingKey?: string | null
}) {
  const meta = accountMeta(value)
  if (mode !== "admin" || !onSetStatus) {
    return <Pill tone={meta.tone} label={meta.label} />
  }
  const saving = pendingKey === `${c.id}:${field}`
  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) =>
        onSetStatus(c.id, field, e.target.value as AccountStatusValue)
      }
      className={`${STATUS_SELECT_CLS} ${PILL_STYLES[meta.tone]}`}
    >
      {ACCOUNT_OPTIONS.map((o) => (
        <option
          key={o.value}
          value={o.value}
          className="bg-background text-foreground"
        >
          {o.label}
        </option>
      ))}
    </select>
  )
}

function WebsiteCell({
  c,
  mode,
  onSetStatus,
  pendingKey,
}: {
  c: CompanyRow
  mode: "user" | "admin"
  onSetStatus?: SetStatusFn
  pendingKey?: string | null
}) {
  const meta = websiteEffectiveMeta(c)
  if (mode !== "admin" || !onSetStatus) {
    return <Pill tone={meta.tone} label={meta.label} />
  }
  const saving = pendingKey === `${c.id}:website`
  // Selected value is the override, or "auto" when following the order.
  const value = c.websiteStatusOverride ?? "auto"
  const autoLabel = `Auto — ${websiteMeta(c.websiteStatus).label}`
  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) =>
        onSetStatus(c.id, "website", e.target.value as SetStatusValue)
      }
      className={`${STATUS_SELECT_CLS} ${PILL_STYLES[meta.tone]}`}
    >
      <option value="auto" className="bg-background text-foreground">
        {autoLabel}
      </option>
      {ACCOUNT_OPTIONS.map((o) => (
        <option
          key={o.value}
          value={o.value}
          className="bg-background text-foreground"
        >
          {o.label}
        </option>
      ))}
    </select>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
}) {
  return (
    <th className="px-4 py-3 font-semibold text-muted-foreground">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-foreground"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUpIcon className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5" />
          )
        ) : (
          <ChevronsUpDownIcon className="size-3.5 opacity-40" />
        )}
      </button>
    </th>
  )
}
