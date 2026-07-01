"use client"

import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LandmarkIcon,
  GlobeIcon,
  CalendarIcon,
  MapPinIcon,
  FileTextIcon,
  UsersIcon,
  DownloadIcon,
  BuildingIcon,
} from "lucide-react"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  dissolved: "destructive",
  liquidation: "destructive",
}

const internalStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  rejected: "destructive",
}

const CH_DOC_BASE = "https://find-and-update.company-information.service.gov.uk"

function humanize(s: string | null) {
  if (!s) return ""
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDate(d: string | null) {
  if (!d) return "—"
  const date = new Date(d)
  return isNaN(date.getTime()) ? d : date.toLocaleDateString()
}

export function CompaniesHouseCard({ orgId }: { orgId: string }) {
  const { data, isLoading } = trpc.companies.companiesHouse.useQuery(
    { orgId },
    { enabled: !!orgId },
  )

  // Not a UK company / no company id / no API key / not found → render nothing
  if (isLoading || !data) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <LandmarkIcon className="size-4 text-amber-500" />
            Companies House
          </div>
          {data.status && (
            <Badge variant={statusVariant[data.status] ?? "secondary"} className="capitalize">
              {data.statusDetail ?? data.status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <BuildingIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Company Name</p>
              <p className="text-sm font-medium">{data.name ?? data.localName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <LandmarkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Application Status</p>
              <Badge
                variant={internalStatusVariant[data.internalStatus] ?? "secondary"}
                className="mt-0.5 capitalize"
              >
                {data.internalStatus}
              </Badge>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Company Number</p>
              <p className="text-sm font-medium">{data.companyNumber}</p>
            </div>
          </div>
          {data.authCode && (
            <div className="flex items-start gap-3">
              <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Auth Code</p>
                <p className="text-sm font-mono">{data.authCode}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <GlobeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm font-medium uppercase">{data.type ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Incorporated</p>
              <p className="text-sm font-medium">{fmtDate(data.incorporationDate)}</p>
            </div>
          </div>
          {data.registeredOffice && (
            <div className="flex items-start gap-3">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Registered Office</p>
                <p className="text-sm font-medium">{data.registeredOffice}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filing deadlines from the register */}
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Confirmation Statement Due</p>
            <p className="text-sm font-medium">{fmtDate(data.confirmationNextDue)}</p>
            {data.confirmationOverdue && (
              <Badge variant="destructive" className="mt-1">Overdue</Badge>
            )}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Accounts Due</p>
            <p className="text-sm font-medium">{fmtDate(data.accountsNextDue)}</p>
            {data.accountsOverdue && (
              <Badge variant="destructive" className="mt-1">Overdue</Badge>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  )
}

export function OfficersCard({ orgId }: { orgId: string }) {
  const { data, isLoading } = trpc.companies.companiesHouse.useQuery(
    { orgId },
    { enabled: !!orgId },
  )

  if (isLoading || !data || data.officers.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="size-4 text-amber-500" />
          Officers
          <span className="text-xs font-normal text-muted-foreground">
            {data.officerCount} officer{data.officerCount === 1 ? "" : "s"} / {data.resignedCount}{" "}
            resignation{data.resignedCount === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {data.officers.map((o, i) => (
            <div key={i} className="space-y-3 py-5 first:pt-0 last:pb-0">
              <p className="font-semibold text-foreground">{o.name}</p>

              {o.address && (
                <div>
                  <p className="text-xs text-muted-foreground">Correspondence address</p>
                  <p className="text-sm">{o.address}</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm capitalize">{humanize(o.role)}</p>
                    {!o.resignedOn && (
                      <Badge variant="default" className="h-4 px-1 text-[10px]">ACTIVE</Badge>
                    )}
                  </div>
                </div>
                {o.dateOfBirth && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date of birth</p>
                    <p className="text-sm">{o.dateOfBirth}</p>
                  </div>
                )}
                {o.appointedOn && (
                  <div>
                    <p className="text-xs text-muted-foreground">Appointed on</p>
                    <p className="text-sm">{new Date(o.appointedOn).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {(o.nationality || o.countryOfResidence) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {o.nationality && (
                    <div>
                      <p className="text-xs text-muted-foreground">Nationality</p>
                      <p className="text-sm">{o.nationality}</p>
                    </div>
                  )}
                  {o.countryOfResidence && (
                    <div>
                      <p className="text-xs text-muted-foreground">Country of residence</p>
                      <p className="text-sm">{o.countryOfResidence}</p>
                    </div>
                  )}
                </div>
              )}

              {o.resignedOn && (
                <div>
                  <p className="text-xs text-muted-foreground">Resigned on</p>
                  <p className="text-sm">{new Date(o.resignedOn).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function FilingHistoryCard({ orgId }: { orgId: string }) {
  const { data, isLoading } = trpc.companies.companiesHouse.useQuery(
    { orgId },
    { enabled: !!orgId },
  )

  if (isLoading || !data || data.filings.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileTextIcon className="size-4 text-amber-500" />
          Filing History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {data.filings.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {humanize(f.category)}
                  {f.type ? ` (${f.type})` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {f.date ? new Date(f.date).toLocaleDateString() : ""}
                </p>
              </div>
              {f.hasDocument && f.transactionId && (
                <a
                  href={`${CH_DOC_BASE}/company/${data.companyNumber}/filing-history/${f.transactionId}/document?format=pdf&download=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <DownloadIcon className="size-3" />
                  PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
