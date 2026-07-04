"use client"

import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CompaniesHouseCard, OfficersCard, FilingHistoryCard } from "@/components/companies-house-card"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Building2Icon,
  GlobeIcon,
  HashIcon,
  FileTextIcon,
  CalendarIcon,
  CalendarClockIcon,
  ReceiptIcon,
  MailIcon,
  AlertCircleIcon,
  Trash2Icon,
} from "lucide-react"

function dueMeta(date: Date) {
  const now = new Date()
  const due = new Date(date)
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  let tone: "danger" | "warn" | "ok" = "ok"
  if (days < 0 || days <= 14) tone = "danger"
  else if (days <= 30) tone = "warn"
  let note = `${days} days left`
  if (days < 0) note = `Overdue by ${Math.abs(days)} days`
  else if (days === 0) note = "Due today"
  return { days, tone, note }
}

const toneStyles: Record<string, string> = {
  danger: "border-red-500/30 bg-red-500/5",
  warn: "border-amber-500/30 bg-amber-500/5",
  ok: "border-border",
}

const toneText: Record<string, string> = {
  danger: "text-red-600",
  warn: "text-amber-600",
  ok: "text-muted-foreground",
}

export default function OverviewPage() {
  const { data: session } = authClient.useSession()
  const activeOrgId = session?.session?.activeOrganizationId

  const { data: org, isLoading } = trpc.companies.getOverview.useQuery(
    { orgId: activeOrgId ?? "" },
    { enabled: !!activeOrgId },
  )

  const router = useRouter()
  const utils = trpc.useUtils()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: invoices } = trpc.invoices.list.useQuery()
  const { data: mails } = trpc.mails.list.useQuery()

  const deleteCompany = trpc.companies.deleteCompany.useMutation({
    onSuccess: (res) => {
      utils.companies.myCompanies.invalidate()
      if (res.nextActiveOrgId) {
        router.push("/dashboard")
        router.refresh()
      } else {
        router.push("/onboard")
      }
    },
  })

  const pendingInvoices = (invoices ?? []).filter(
    (inv) => inv.status === "unpaid" || inv.status === "processing",
  )
  const unreadMails = (mails ?? []).filter((m) => !m.read)

  const actionDocuments = (org?.documents ?? []).filter(
    (d) => d.status === "rejected" || d.status === "requested",
  )

  const isPersonal = org?.type === "personal"

  // UK filing deadlines come live from Companies House (shown in that card).
  // Only US companies use manually-set deadline dates.
  const hasCompaniesHouse = org?.country === "uk" && !!org?.companyId && !isPersonal
  const deadlines =
    org && org.country === "us"
      ? [
          { label: "State Filing Due", date: org.stateFilingDue },
          { label: "Federal Filing Due", date: org.federalFilingDue },
          { label: "State Tax Due", date: org.stateTaxDue },
        ]
          .filter((d): d is { label: string; date: Date } => d.date != null)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      : []

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
        <h1 className="text-2xl font-semibold text-foreground uppercase">
          {isPersonal ? (session?.user?.name ?? org.name) : org.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPersonal
            ? "Personal Account"
            : `${org.country === "uk" ? "United Kingdom" : "United States"} Company`}
        </p>
      </div>

      {isPersonal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2Icon className="size-4 text-amber-500" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted text-base font-medium">
                {(session?.user?.name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{session?.user?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">
                  {new Date(org.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasCompaniesHouse && !isPersonal && (
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
      )}

      {!isPersonal && activeOrgId && <CompaniesHouseCard orgId={activeOrgId} />}
      {!isPersonal && activeOrgId && <OfficersCard orgId={activeOrgId} />}
      {!isPersonal && activeOrgId && <FilingHistoryCard orgId={activeOrgId} />}

      {!isPersonal && actionDocuments.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircleIcon className="size-4 text-red-500" />
              Documents Need Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-red-600">
                    {doc.status === "rejected"
                      ? doc.rejectReason
                        ? `Rejected: ${doc.rejectReason}`
                        : "Rejected — please re-upload"
                      : "Requested — please upload"}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href="/dashboard/documents">Upload</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {deadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClockIcon className="size-4 text-amber-500" />
              Filing Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deadlines.map((d) => {
              const meta = dueMeta(d.date)
              return (
                <div
                  key={d.label}
                  className={`flex items-center justify-between rounded-lg border p-3 ${toneStyles[meta.tone]}`}
                >
                  <div>
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className={`text-xs ${toneText[meta.tone]}`}>{meta.note}</p>
                  </div>
                  <p className="text-sm font-medium">
                    {new Date(d.date).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

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

      {unreadMails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailIcon className="size-4 text-amber-500" />
              Unread Mail
              <Badge className="ml-1">{unreadMails.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unreadMails.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.subject}</p>
                  <p className="text-xs text-muted-foreground">From: {m.from}</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/mail">View</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isPersonal && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this company</p>
            <p className="text-xs text-muted-foreground">
              Permanently hides it from your account. This cannot be undone.
            </p>
          </div>
          <Button
            variant="outline"
            className="text-red-500"
            onClick={() => setDeleteOpen(true)}
            disabled={!activeOrgId}
          >
            <Trash2Icon className="size-4" />
            Delete
          </Button>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete company"
        description={`Delete "${org.name}"? You will lose access to it and this cannot be undone.`}
        onConfirm={() => activeOrgId && deleteCompany.mutate({ id: activeOrgId })}
        loading={deleteCompany.isPending}
      />
    </div>
  )
}
