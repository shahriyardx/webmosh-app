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
} from "lucide-react"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  dissolved: "destructive",
  liquidation: "destructive",
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

        {/* Officers */}
        {data.officers.filter((o) => !o.resignedOn).length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <UsersIcon className="size-3.5" />
              Officers
            </p>
            <div className="space-y-1.5">
              {data.officers
                .filter((o) => !o.resignedOn)
                .map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {o.role?.replace(/-/g, " ") ?? ""}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
