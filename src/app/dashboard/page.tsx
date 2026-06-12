"use client"

import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Building2Icon,
  GlobeIcon,
  HashIcon,
  FileTextIcon,
  CalendarIcon,
  ReceiptIcon,
} from "lucide-react"

export default function OverviewPage() {
  const { data: session } = authClient.useSession()
  const activeOrgId = session?.session?.activeOrganizationId

  const { data: org, isLoading } = trpc.companies.getOverview.useQuery(
    { orgId: activeOrgId ?? "" },
    { enabled: !!activeOrgId },
  )

  const { data: invoices } = trpc.invoices.list.useQuery()

  const pendingInvoices = (invoices ?? []).filter(
    (inv) => inv.status === "unpaid" || inv.status === "processing",
  )

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Organization not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground uppercase">{org.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {org.country === "uk" ? "United Kingdom" : "United States"} Company
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2Icon className="size-4 text-amber-500" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Country</p>
              <p className="text-sm font-medium">
                {org.country === "uk" ? "United Kingdom" : "United States"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge
                variant={
                  org.status === "rejected"
                    ? "destructive"
                    : org.status === "processing"
                      ? "default"
                      : "secondary"
                }
                className="mt-0.5"
              >
                {org.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HashIcon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">SIC Code</p>
              <p className="text-sm font-medium">{org.sicCode ?? "—"}</p>
            </div>
          </div>
          {org.country === "uk" && org.companyId && (
            <div className="flex items-center gap-3">
              <HashIcon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Company ID</p>
                <p className="text-sm font-medium">{org.companyId}</p>
              </div>
            </div>
          )}
          {org.country === "uk" && org.authCode && (
            <div className="flex items-center gap-3">
              <HashIcon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Auth Code</p>
                <p className="text-sm font-mono">{org.authCode}</p>
              </div>
            </div>
          )}
          {org.sicDescription && (
            <div className="flex items-center gap-3">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">
                  Business Activity
                </p>
                <p className="text-sm font-medium">{org.sicDescription}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">
                {new Date(org.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {pendingInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptIcon className="size-4 text-amber-500" />
              Pending Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">${inv.amount}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {inv.status === "unpaid" ? "Unpaid" : "Processing"}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/invoices/${inv.id}`}>
                    {inv.status === "unpaid" ? "Pay Now" : "View"}
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
