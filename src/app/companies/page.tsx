"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Building2Icon,
  PlusIcon,
  SearchIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from "lucide-react"

type Company = inferRouterOutputs<AppRouter>["companies"]["myCompanies"][number]

type SortKey =
  | "name"
  | "number"
  | "incorporation"
  | "status"
  | "accountsDue"
  | "statementDue"
  | "services"

const PAGE_SIZE = 10

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("en-GB")
}

function statusLabel(c: Company) {
  if (c.chStatus) {
    return c.chStatus
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }
  return c.status.charAt(0).toUpperCase() + c.status.slice(1)
}

function isActive(c: Company) {
  if (c.chStatus) return c.chStatus === "active"
  return c.status === "completed"
}

function actionNeeded(c: Company) {
  const now = Date.now()
  const overdue = (d: Date | null | undefined) =>
    !!d && new Date(d).getTime() < now
  return overdue(c.accountsFilingDue) || overdue(c.confirmationStatementDue)
}

export default function CompaniesPage() {
  const { data: allCompanies, isLoading } = trpc.companies.myCompanies.useQuery()
  const companies = useMemo(
    () => (allCompanies ?? []).filter((c) => c.type !== "personal"),
    [allCompanies],
  )

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

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Companies
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Pick a company to open its dashboard.
          </p>
        </div>
        <Button asChild>
          <Link href="/onboard">
            <PlusIcon className="size-4" />
            New Company
          </Link>
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <Building2Icon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No companies yet.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Form your first UK or US company in a few minutes.
          </p>
          <Button asChild size="sm" className="mt-2">
            <Link href="/onboard">
              <PlusIcon className="size-3" />
              Create Company
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
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
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <SortHeader
                    label="Company Name"
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                  <SortHeader
                    label="Company Number"
                    active={sortKey === "number"}
                    dir={sortDir}
                    onClick={() => toggleSort("number")}
                  />
                  <SortHeader
                    label="Incorporation Date"
                    active={sortKey === "incorporation"}
                    dir={sortDir}
                    onClick={() => toggleSort("incorporation")}
                  />
                  <SortHeader
                    label="Status"
                    active={sortKey === "status"}
                    dir={sortDir}
                    onClick={() => toggleSort("status")}
                  />
                  <SortHeader
                    label="Accounts Due"
                    active={sortKey === "accountsDue"}
                    dir={sortDir}
                    onClick={() => toggleSort("accountsDue")}
                  />
                  <SortHeader
                    label="Statement Due"
                    active={sortKey === "statementDue"}
                    dir={sortDir}
                    onClick={() => toggleSort("statementDue")}
                  />
                  <SortHeader
                    label="My Services"
                    active={sortKey === "services"}
                    dir={sortDir}
                    onClick={() => toggleSort("services")}
                  />
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
                          href={`/companies/${c.id}/overview`}
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
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No companies match &ldquo;{search}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: showing + pagination */}
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
      )}
    </div>
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
        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
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
