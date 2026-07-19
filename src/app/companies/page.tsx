"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  Building2Icon,
  PlusIcon,
  ArrowRightIcon,
  HashIcon,
  CalendarIcon,
  GlobeIcon,
} from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  completed:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
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

export default function CompaniesPage() {
  const { data: allCompanies, isLoading } = trpc.companies.myCompanies.useQuery()
  // Personal accounts are shown separately (Account overview on /dashboard),
  // so keep the Companies list scoped to real companies only.
  const companies = allCompanies?.filter((c) => c.type !== "personal")

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
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

      {!companies || companies.length === 0 ? (
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
        <div className="grid gap-3">
          {companies.map((c) => {
            const cls = STATUS_STYLES[c.status] ?? STATUS_STYLES.pending
            const color = companyColor(c.name)
            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}/overview`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-sky-500/40 hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color.bg}`}
                  >
                    <span className={`text-sm font-bold ${color.text}`}>
                      {initials(c.name)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold uppercase tracking-wide text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                      {c.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.type === "personal" ? (
                        <span>Personal Account</span>
                      ) : (
                        <>
                          {c.country && (
                            <span className="flex items-center gap-1">
                              <GlobeIcon className="size-3" />
                              {c.country === "uk"
                                ? "United Kingdom"
                                : "United States"}
                            </span>
                          )}
                          {c.companyId && (
                            <span className="flex items-center gap-1 font-mono">
                              <HashIcon className="size-3" />
                              {c.companyId}
                            </span>
                          )}
                        </>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="size-3" />
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${cls}`}
                  >
                    {c.status}
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
