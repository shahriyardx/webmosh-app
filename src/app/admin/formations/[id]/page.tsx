"use client"

import { use, useState } from "react"
import { CompanyStatus } from "@/generated/prisma/enums"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowLeftIcon,
  Building2Icon,
  GlobeIcon,
  FileTextIcon,
  HashIcon,
  CalendarIcon,
  UserIcon,
  ReceiptIcon,
  DownloadIcon,
  CheckIcon,
  XIcon,
} from "lucide-react"
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
} from "@/components/ui/multi-select"

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

const docStatusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  requested: { label: "Requested", variant: "outline" },
  submitted: { label: "Submitted", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

const invStatusLabel: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

export default function FormationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const utils = trpc.useUtils()

  const { data: org, isLoading } = trpc.companies.getById.useQuery({ id })
  const reviewDoc = trpc.companies.reviewDocument.useMutation({
    onSuccess: () => utils.companies.getById.invalidate({ id }),
  })
  const updateStatus = trpc.companies.updateStatus.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      utils.companies.listAll.invalidate()
    },
  })

  const [rejecting, setRejecting] = useState<{ docId: string; docName: string } | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [requestModal, setRequestModal] = useState(false)
  const [requestDocName, setRequestDocName] = useState("")

  const requestDoc = trpc.companies.requestDocument.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      setRequestModal(false)
      setRequestDocName("")
    },
  })

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
        <p className="text-sm text-muted-foreground">Company not found.</p>
      </div>
    )
  }

  const owner = org.members.find((m) => m.role === "owner")?.user
  const sb = statusBadge[org.status] ?? statusBadge.pending

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/formations">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.country === "uk" ? "United Kingdom" : "United States"} Company
          </p>
        </div>
      </div>

      {/* Company info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2Icon className="size-4 text-amber-500" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Status</p>
                  <MultiSelect
                    single
                    values={[org.status]}
                    onValuesChange={(vals) => {
                      const v = vals[0]
                      if (v) updateStatus.mutate({ id, status: v as CompanyStatus })
                    }}
                  >
                    <MultiSelectTrigger className="h-7 px-2 text-xs">
                      <MultiSelectValue />
                    </MultiSelectTrigger>
                    <MultiSelectContent>
                      <MultiSelectItem value="pending">Pending</MultiSelectItem>
                      <MultiSelectItem value="processing">Processing</MultiSelectItem>
                      <MultiSelectItem value="completed">Completed</MultiSelectItem>
                      <MultiSelectItem value="rejected">Rejected</MultiSelectItem>
                    </MultiSelectContent>
                  </MultiSelect>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Country</p>
                <p className="text-sm font-medium capitalize">{org.country ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <HashIcon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">SIC Code</p>
                <p className="text-sm font-medium">{org.sicCode ?? "—"}</p>
              </div>
            </div>
            {org.sicDescription && (
              <div className="flex items-start gap-3">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Business Activity</p>
                  <p className="text-sm font-medium">{org.sicDescription}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
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

        {/* Owner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="size-4 text-amber-500" />
              Owner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {owner ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {owner.name?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{owner.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{owner.email}</p>
                  </div>
                </div>
                {org.members.length > 1 && (
                  <div className="text-xs text-muted-foreground">
                    {org.members.length - 1} other member{org.members.length - 1 !== 1 ? "s" : ""}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No owner found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Directors */}
      {org.directors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="size-4 text-amber-500" />
              Directors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {org.directors.map((d) => (
                <div key={d.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">{d.firstName} {d.lastName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm">{d.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm">{d.phone}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="text-sm">{d.dateOfBirth}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm">{d.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <FileTextIcon className="size-4 text-amber-500" />
              Documents
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRequestModal(true)}
            >
              + Request
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {org.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents.</p>
          ) : (
            <div className="divide-y divide-border">
              {org.documents.map((doc) => {
                const ds = docStatusBadge[doc.status] ?? docStatusBadge.requested
                return (
                  <div key={doc.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        {doc.rejectReason && (
                          <p className="text-xs text-red-500">{doc.rejectReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ds.variant}>{ds.label}</Badge>
                      {doc.value && (
                        <Button variant="outline" size="icon" className="size-8" asChild>
                          <a href={doc.value} target="_blank" rel="noopener noreferrer">
                            <DownloadIcon className="size-4" />
                          </a>
                        </Button>
                      )}
                      {doc.status === "submitted" && (
                        <>
                          <Button
                            variant="default"
                            size="icon"
                            className="size-8"
                            onClick={() => reviewDoc.mutate({ documentId: doc.id, status: "approved" })}
                            disabled={reviewDoc.isPending}
                          >
                            <CheckIcon className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8 text-red-500"
                            onClick={() => setRejecting({ docId: doc.id, docName: doc.name })}
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptIcon className="size-4 text-amber-500" />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {org.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          ) : (
            <div className="divide-y divide-border">
              {org.invoices.map((inv) => {
                const is = invStatusLabel[inv.status] ?? invStatusLabel.unpaid
                return (
                  <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">${inv.amount}</p>
                      <p className="text-xs text-muted-foreground font-mono">{inv.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={is.variant}>{is.label}</Badge>
                      {inv.transactionId && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {inv.transactionId}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request document modal */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Request Document</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the name of the document you want to request.
            </p>
            <Input
              className="mt-4"
              placeholder="e.g. Utility Bill"
              value={requestDocName}
              onChange={(e) => setRequestDocName(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRequestModal(false); setRequestDocName("") }}>
                Cancel
              </Button>
              <Button
                onClick={() => requestDoc.mutate({ organizationId: id, name: requestDocName })}
                disabled={!requestDocName || requestDoc.isPending}
              >
                {requestDoc.isPending ? "Requesting…" : "Request"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Reject Document</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide a reason for rejecting &quot;{rejecting.docName}&quot;.
            </p>
            <Input
              className="mt-4"
              placeholder="e.g. Blurry image, missing info"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRejecting(null); setRejectReason("") }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  reviewDoc.mutate({ documentId: rejecting.docId, status: "rejected", reason: rejectReason })
                  setRejecting(null)
                  setRejectReason("")
                }}
                disabled={!rejectReason || reviewDoc.isPending}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
