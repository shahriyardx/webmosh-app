"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Building2Icon,
  ArrowRightIcon,
  Trash2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react"

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "Pending",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  processing: {
    label: "Processing",
    cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  completed: {
    label: "Completed",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  },
}

const STATUS_META: { key: string; label: string; accent: string }[] = [
  { key: "pending", label: "Pending", accent: "text-amber-600 dark:text-amber-400" },
  { key: "processing", label: "Processing", accent: "text-sky-600 dark:text-sky-400" },
  { key: "completed", label: "Completed", accent: "text-emerald-600 dark:text-emerald-400" },
  { key: "rejected", label: "Rejected", accent: "text-red-600 dark:text-red-400" },
]

const COUNTRIES = [
  { v: "all", l: "All countries" },
  { v: "uk", l: "🇬🇧 UK" },
  { v: "us", l: "🇺🇸 US" },
] as const

const countryFlag = (c: string | null) =>
  c === "uk" ? "🇬🇧 UK" : c === "us" ? "🇺🇸 US" : "—"

export default function AdminFormationsPage() {
  const { data: companies, isLoading } = trpc.companies.listAll.useQuery()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [countryFilter, setCountryFilter] = useState<string>("all")
  const [ownerFilter, setOwnerFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  const list = companies ?? []
  const ownerOf = (c: (typeof list)[number]) =>
    c.members.find((m) => m.role === "owner")?.user
  const q = search.trim().toLowerCase()
  const matchesSearch = (c: (typeof list)[number]) => {
    if (!q) return true
    const owner = ownerOf(c)
    return (
      c.name.toLowerCase().includes(q) ||
      (owner?.name ?? owner?.email ?? "").toLowerCase().includes(q)
    )
  }

  // Distinct owners for the User filter.
  const owners = Array.from(
    new Map(
      list
        .map((c) => ownerOf(c))
        .filter((u): u is NonNullable<typeof u> => !!u)
        .map((u) => [u.id, u] as const),
    ).values(),
  ).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))

  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null
  const toMs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null

  // Faceted: status counts reflect every other active filter.
  const base = list.filter((c) => {
    if (countryFilter !== "all" && c.country !== countryFilter) return false
    if (ownerFilter !== "all" && ownerOf(c)?.id !== ownerFilter) return false
    if (!matchesSearch(c)) return false
    const t = new Date(c.createdAt).getTime()
    if (fromMs !== null && t < fromMs) return false
    if (toMs !== null && t > toMs) return false
    return true
  })
  const statusCount = (key: string) =>
    key === "all" ? base.length : base.filter((c) => c.status === key).length

  const filtered =
    statusFilter === "all" ? base : base.filter((c) => c.status === statusFilter)

  const presentStatuses = STATUS_META.filter((s) =>
    list.some((c) => c.status === s.key),
  )
  const filtersActive =
    statusFilter !== "all" ||
    countryFilter !== "all" ||
    ownerFilter !== "all" ||
    !!dateFrom ||
    !!dateTo ||
    q.length > 0
  const clearFilters = () => {
    setStatusFilter("all")
    setCountryFilter("all")
    setOwnerFilter("all")
    setDateFrom("")
    setDateTo("")
    setSearch("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Formations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All company formations.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/formations/trash">
            <Trash2Icon className="size-4" />
            Trash
          </Link>
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <Building2Icon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">
            No formations yet.
          </p>
        </div>
      ) : (
        <>
          {/* Status filter cards (click to filter; counts are faceted) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FilterCard
              label="Total"
              value={statusCount("all")}
              accent="text-foreground"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            {presentStatuses.map((s) => (
              <FilterCard
                key={s.key}
                label={s.label}
                value={statusCount(s.key)}
                accent={s.accent}
                active={statusFilter === s.key}
                onClick={() => setStatusFilter(s.key)}
              />
            ))}
          </div>

          {/* Always-open filter panel */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Company or owner…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Country</Label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.v} value={c.v}>
                        {c.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">User</Label>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {owners.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {filtersActive && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <XIcon className="size-3.5" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {list.length} formations
          </p>

          {/* Formation cards */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              No formations match your filters.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((org) => {
                const sp = STATUS_PILL[org.status] ?? STATUS_PILL.pending
                const owner = ownerOf(org)
                return (
                  <Link
                    key={org.id}
                    href={`/admin/formations/${org.id}`}
                    className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-sky-500/30 hover:shadow-md"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 ring-1 ring-inset ring-sky-500/20">
                      <Building2Icon className="size-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {org.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {owner?.name ?? owner?.email ?? "—"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5">
                      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                        {countryFlag(org.country)}
                      </span>
                      <span className="hidden rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground md:inline">
                        {org.documents.length} docs
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${sp.cls}`}
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        {sp.label}
                      </span>
                      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-sky-500" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FilterCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string
  value: number
  accent: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:border-sky-500/40 ${
        active ? "border-sky-500 ring-2 ring-sky-500/30" : "border-border"
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>
        {value}
      </p>
    </button>
  )
}
