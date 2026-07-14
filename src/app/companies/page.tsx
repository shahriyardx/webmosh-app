"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Building2Icon,
  PlusIcon,
  ArrowRightIcon,
  HashIcon,
  CalendarIcon,
  GlobeIcon,
} from "lucide-react"

const statusVariant: Record<
  string,
  "outline" | "secondary" | "default" | "destructive"
> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  rejected: "destructive",
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Companies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Building2Icon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No companies yet.</p>
            <Button asChild size="sm">
              <Link href="/onboard">
                <PlusIcon className="size-3" />
                Create Company
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {companies.map((c) => {
            const variant = statusVariant[c.status] ?? "outline"
            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}/overview`}
                className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Building2Icon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium uppercase text-foreground">
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
                              {c.country === "uk" ? "UK" : "US"}
                            </span>
                          )}
                          {c.companyId && (
                            <span className="flex items-center gap-1">
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
                <div className="flex items-center gap-3">
                  <Badge variant={variant} className="capitalize">
                    {c.status}
                  </Badge>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )

}