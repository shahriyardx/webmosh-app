"use client"

import { useMemo } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { CompaniesTable } from "@/components/companies-table"
import { Building2Icon, PlusIcon } from "lucide-react"

export default function CompaniesPage() {
  const { data: allCompanies, isLoading } = trpc.companies.myCompanies.useQuery()
  const companies = useMemo(
    () => (allCompanies ?? []).filter((c) => c.type !== "personal"),
    [allCompanies],
  )

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
        <CompaniesTable companies={companies} mode="user" />
      )}
    </div>
  )
}
