"use client"

import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CompaniesHouseCard, OfficersCard, FilingHistoryCard } from "@/components/companies-house-card"
import { CompanyServicesWidget } from "@/components/company-services-widget"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import {
  DirectorEditDialog,
  type EditableDirector,
} from "@/components/director-edit-dialog"
import { useRouter, useParams } from "next/navigation"
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
  UserIcon,
  ExternalLinkIcon,
  MonitorIcon,
  PencilIcon,
} from "lucide-react"

const docStatusBadge: Record<
  string,
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  requested: { label: "Requested", variant: "outline" },
  submitted: { label: "Submitted", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

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
  warn: "border-sky-500/30 bg-sky-500/5",
  ok: "border-border",
}

const toneText: Record<string, string> = {
  danger: "text-red-600",
  warn: "text-sky-600",
  ok: "text-muted-foreground",
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

/** Compact stat tile used inside the seamless details grid. */
function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  )
}

/** Full-width labelled block for longer values (address, website, …). */
function InfoBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-foreground">
        {children}
      </div>
    </div>
  )
}

const orgStatusVariant = (s: string): "outline" | "secondary" | "default" | "destructive" =>
  s === "rejected" ? "destructive" : s === "processing" ? "default" : "secondary"

export default function OverviewPage() {
  const { data: session } = authClient.useSession()
  const params = useParams()
  const companyId = typeof params?.companyId === "string" ? params.companyId : ""

  const { data: org, isLoading } = trpc.companies.getOverview.useQuery(
    { orgId: companyId },
    { enabled: !!companyId },
  )

  const router = useRouter()
  const utils = trpc.useUtils()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editDirector, setEditDirector] = useState<EditableDirector | null>(
    null,
  )

  const { data: invoices } = trpc.invoices.list.useQuery(
    { organizationId: companyId },
    { enabled: !!companyId },
  )
  const { data: mails } = trpc.mails.list.useQuery(
    { organizationId: companyId },
    { enabled: !!companyId },
  )

  const deleteCompany = trpc.companies.deleteCompany.useMutation({
    onSuccess: () => {
      utils.companies.myCompanies.invalidate()
      utils.companies.hasPersonalCompany.invalidate()
      router.push("/dashboard")
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
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
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
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-sky-500/[0.07] via-transparent to-transparent p-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-lg font-bold text-sky-600 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
          {initials(isPersonal ? (session?.user?.name ?? org.name) : org.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold uppercase tracking-tight text-foreground">
              {isPersonal ? (session?.user?.name ?? org.name) : org.name}
            </h1>
            {!isPersonal && (
              <Badge variant={orgStatusVariant(org.status)} className="capitalize">
                {org.status}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <GlobeIcon className="size-3.5" />
              {isPersonal
                ? "Personal Account"
                : org.country === "uk"
                  ? "United Kingdom Company"
                  : "United States Company"}
            </span>
            {!isPersonal && org.companyId && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                <HashIcon className="size-3.5" />
                {org.companyId}
              </span>
            )}
          </div>
        </div>
      </div>

      {isPersonal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2Icon className="size-4 text-sky-500" />
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
            <Building2Icon className="size-4 text-sky-500" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            <StatTile
              label="Country"
              value={org.country === "uk" ? "United Kingdom" : "United States"}
            />
            <StatTile
              label="Status"
              value={
                <Badge
                  variant={orgStatusVariant(org.status)}
                  className="capitalize"
                >
                  {org.status}
                </Badge>
              }
            />
            {org.state && <StatTile label="State" value={org.state} />}
            {org.ein && <StatTile label="EIN" value={org.ein} />}
            {org.sicCode && <StatTile label="SIC Code" value={org.sicCode} />}
            {org.country === "uk" && org.companyId && (
              <StatTile label="Company ID" value={org.companyId} />
            )}
            {org.country === "uk" && org.authCode && (
              <StatTile
                label="Auth Code"
                value={<span className="font-mono">{org.authCode}</span>}
              />
            )}
            <StatTile
              label="Created"
              value={new Date(org.createdAt).toLocaleDateString()}
            />
          </div>

          {org.registeredAddress && (
            <InfoBlock label="Registered Address">
              <span className="whitespace-pre-line">
                {org.registeredAddress}
              </span>
            </InfoBlock>
          )}
          {org.sicDescription && (
            <InfoBlock label="Business Activity">{org.sicDescription}</InfoBlock>
          )}
          {org.website && (
            <InfoBlock label="Website">
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-sky-600 hover:underline dark:text-sky-400"
              >
                {org.website}
              </a>
            </InfoBlock>
          )}
        </CardContent>
      </Card>
      )}

      {companyId && <CompanyServicesWidget orgId={companyId} />}

      {!isPersonal && companyId && <CompaniesHouseCard orgId={companyId} />}
      {!isPersonal && companyId && <OfficersCard orgId={companyId} />}
      {!isPersonal && companyId && <FilingHistoryCard orgId={companyId} />}

      {/* RDP access provisioned for this company's service orders */}
      {org.serviceOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorIcon className="size-4 text-sky-500" />
              RDP Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {org.serviceOrders.map((o) => (
              <div key={o.id} className="rounded-lg border border-border p-4">
                <p className="text-sm font-semibold">
                  {o.service?.title ?? "Service"}
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Host / IP</dt>
                    <dd className="break-all font-mono text-sm">
                      {o.rdpHost || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Username</dt>
                    <dd className="break-all font-mono text-sm">
                      {o.rdpUsername || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Password</dt>
                    <dd className="break-all font-mono text-sm">
                      {o.rdpPassword || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Formation details the client submitted */}
      {!isPersonal && org.directors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="size-4 text-sky-500" />
              {org.directors.length > 1 ? "Directors" : "Director"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {org.directors.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {d.firstName} {d.lastName}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditDirector({
                        id: d.id,
                        firstName: d.firstName,
                        lastName: d.lastName,
                        email: d.email,
                        phone: d.phone,
                        dateOfBirth: d.dateOfBirth,
                        address: d.address,
                      })
                    }
                  >
                    <PencilIcon className="size-3.5" />
                    Edit
                  </Button>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="break-all text-sm">{d.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Phone</dt>
                    <dd className="text-sm">{d.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Date of birth
                    </dt>
                    <dd className="text-sm">{d.dateOfBirth || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Address</dt>
                    <dd className="whitespace-pre-wrap text-sm">
                      {d.address || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isPersonal && org.documents.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileTextIcon className="size-4 text-sky-500" />
              Your Documents
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/companies/${companyId}/documents`}>Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {org.documents.map((doc) => {
              const db = docStatusBadge[doc.status] ?? docStatusBadge.submitted
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                      <FileTextIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={db.variant}>{db.label}</Badge>
                    {doc.value && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={doc.value}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLinkIcon className="size-3.5" />
                          View
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

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
                  <Link href={`/companies/${companyId}/documents`}>Upload</Link>
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
              <CalendarClockIcon className="size-4 text-sky-500" />
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
              <ReceiptIcon className="size-4 text-sky-500" />
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
                  <Link href={`/companies/${companyId}/invoices/${inv.id}`}>
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
              <MailIcon className="size-4 text-sky-500" />
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
                  <Link href={`/companies/${companyId}/mail`}>View</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {isPersonal ? "Delete personal account" : "Delete this company"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isPersonal
              ? "Permanently removes your personal account and its invoices and services. This cannot be undone."
              : "Permanently hides it from your account. This cannot be undone."}
          </p>
        </div>
        <Button
          variant="outline"
          className="text-red-500"
          onClick={() => setDeleteOpen(true)}
          disabled={!companyId}
        >
          <Trash2Icon className="size-4" />
          Delete
        </Button>
      </div>

      {editDirector && companyId && (
        <DirectorEditDialog
          open={!!editDirector}
          onOpenChange={(o) => !o && setEditDirector(null)}
          organizationId={companyId}
          director={editDirector}
          onSaved={() =>
            utils.companies.getOverview.invalidate({ orgId: companyId })
          }
        />
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={isPersonal ? "Delete personal account" : "Delete company"}
        description={
          isPersonal
            ? `Delete your personal account? You will lose access to any personal invoices and services. This cannot be undone.`
            : `Delete "${org.name}"? You will lose access to it and this cannot be undone.`
        }
        onConfirm={() => companyId && deleteCompany.mutate({ id: companyId })}
        loading={deleteCompany.isPending}
      />
    </div>
  )
}
