"use client"

import { use, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { CompanyStatus, PaymentStatus } from "@/generated/prisma/enums"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  SettingsIcon,
  MailIcon,
  PaperclipIcon,
  Trash2Icon,
} from "lucide-react"
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
} from "@/components/ui/multi-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CompaniesHouseCard, OfficersCard, FilingHistoryCard } from "@/components/companies-house-card"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = new Date(d)
  if (isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function DateField({
  control,
  name,
  label,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any
  name: string
  label: string
}) {
  return (
    <div className="flex items-start gap-3">
      <CalendarIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Input type="date" className="mt-1 h-8 text-sm" {...field} />
          )}
        />
      </div>
    </div>
  )
}

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
  const router = useRouter()
  const utils = trpc.useUtils()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteFormation = trpc.companies.deleteFormation.useMutation({
    onSuccess: () => {
      utils.companies.listAll.invalidate()
      toast.success("Formation deleted")
      router.push("/admin/formations")
    },
  })

  const { data: org, isLoading } = trpc.companies.getById.useQuery({ id })
  const reviewDoc = trpc.companies.reviewDocument.useMutation({
    onSuccess: (data) => {
      utils.companies.getById.invalidate({ id })
      toast.success(data.status === "approved" ? "Document approved" : "Document rejected")
    },
  })
  const [rejecting, setRejecting] = useState<{ docId: string; docName: string } | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [requestModal, setRequestModal] = useState(false)
  const [requestDocName, setRequestDocName] = useState("")

  const [adminStatus, setAdminStatus] = useState(org?.status ?? ("pending" as string))
  const [saving, setSaving] = useState(false)

  const adminSchema = z.object({
    companyId: z.string().optional(),
    authCode: z.string().optional(),
    confirmationStatementDue: z.string().optional(),
    accountsFilingDue: z.string().optional(),
    stateFilingDue: z.string().optional(),
    federalFilingDue: z.string().optional(),
    stateTaxDue: z.string().optional(),
  })

  const adminForm = useForm({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      companyId: "",
      authCode: "",
      confirmationStatementDue: "",
      accountsFilingDue: "",
      stateFilingDue: "",
      federalFilingDue: "",
      stateTaxDue: "",
    },
  })
  const { control: adminControl, reset: adminReset } = adminForm

  const updateStatus = trpc.companies.updateStatus.useMutation()
  const adminUpdate = trpc.companies.updateCompanyDetails.useMutation()

  useEffect(() => {
    if (org) {
      setAdminStatus(org.status)
    }
  }, [org])

  useEffect(() => {
    if (org) {
      adminReset({
        companyId: org.companyId ?? "",
        authCode: org.authCode ?? "",
        confirmationStatementDue: toDateInput(org.confirmationStatementDue),
        accountsFilingDue: toDateInput(org.accountsFilingDue),
        stateFilingDue: toDateInput(org.stateFilingDue),
        federalFilingDue: toDateInput(org.federalFilingDue),
        stateTaxDue: toDateInput(org.stateTaxDue),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id])

  const onAdminSave = adminForm.handleSubmit(async (data) => {
    if (!org || saving) return
    setSaving(true)
    const promises: Promise<unknown>[] = []
    if (adminStatus !== org.status) {
      promises.push(updateStatus.mutateAsync({ id, status: adminStatus as CompanyStatus }))
    }
    promises.push(
      adminUpdate.mutateAsync({
        id,
        companyId: data.companyId ?? "",
        authCode: data.authCode ?? "",
        confirmationStatementDue: data.confirmationStatementDue || null,
        accountsFilingDue: data.accountsFilingDue || null,
        stateFilingDue: data.stateFilingDue || null,
        federalFilingDue: data.federalFilingDue || null,
        stateTaxDue: data.stateTaxDue || null,
      }),
    )
    await Promise.all(promises)
    utils.companies.getById.invalidate({ id })
    utils.companies.listAll.invalidate()
    toast.success("Settings saved")
    setSaving(false)
  })

  const requestDoc = trpc.companies.requestDocument.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      setRequestModal(false)
      setRequestDocName("")
      toast.success("Document requested")
    },
  })

  const { data: mails } = trpc.mails.listByOrg.useQuery({ organizationId: id })
  const [mailModal, setMailModal] = useState(false)
  const [mailFrom, setMailFrom] = useState("")
  const [mailSubject, setMailSubject] = useState("")
  const [mailBody, setMailBody] = useState("")
  const [mailFiles, setMailFiles] = useState<File[]>([])
  const [mailUploading, setMailUploading] = useState(false)
  const mailFileRef = useRef<HTMLInputElement>(null)

  const createMail = trpc.mails.create.useMutation({
    onSuccess: () => {
      utils.mails.listByOrg.invalidate({ organizationId: id })
      setMailModal(false)
      setMailFrom("")
      setMailSubject("")
      setMailBody("")
      setMailFiles([])
      toast.success("Mail added")
    },
  })

  const deleteMail = trpc.mails.delete.useMutation({
    onSuccess: () => {
      utils.mails.listByOrg.invalidate({ organizationId: id })
      toast.success("Mail deleted")
    },
  })

  const [invRejecting, setInvRejecting] = useState<{ id: string } | null>(null)
  const [invRejectReason, setInvRejectReason] = useState("")
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [invoiceAmount, setInvoiceAmount] = useState("")
  const [invoiceDescription, setInvoiceDescription] = useState("")
  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      setInvoiceModal(false)
      setInvoiceAmount("")
      setInvoiceDescription("")
      toast.success("Invoice created")
    },
  })
  const approveInvoice = trpc.invoices.approve.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      toast.success("Invoice approved")
    },
  })
  const rejectInvoice = trpc.invoices.reject.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      setInvRejecting(null)
      setInvRejectReason("")
      toast.success("Invoice rejected")
    },
  })
  const [invDeleteTarget, setInvDeleteTarget] = useState<{ id: string } | null>(null)
  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      utils.companies.getById.invalidate({ id })
      setInvDeleteTarget(null)
      toast.success("Invoice deleted")
    },
  })

  const handleAddMail = async () => {
    setMailUploading(true)
    try {
      let attachments: string[] = []
      if (mailFiles.length > 0) {
        const fd = new FormData()
        mailFiles.forEach((f) => fd.append("mail", f))
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        if (!res.ok) throw new Error("Upload failed")
        const data: { files: { name: string; url: string }[] } = await res.json()
        attachments = data.files.map((f) => f.url)
      }
      await createMail.mutateAsync({
        organizationId: id,
        from: mailFrom,
        subject: mailSubject,
        body: mailBody,
        attachments,
      })
    } catch {
      toast.error("Failed to add mail")
    } finally {
      setMailUploading(false)
    }
  }

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
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.country === "uk" ? "United Kingdom" : "United States"} Company
          </p>
        </div>
        <Button variant="outline" className="text-red-500" onClick={() => setDeleteOpen(true)}>
          <Trash2Icon className="size-4" />
          Delete
        </Button>
      </div>

      <DeleteConfirmDialog
        open={!!invDeleteTarget}
        onOpenChange={(o) => !o && setInvDeleteTarget(null)}
        title="Delete invoice"
        description="Delete this invoice? It will be hidden and excluded from revenue. This cannot be undone."
        onConfirm={() => invDeleteTarget && deleteInvoice.mutate({ id: invDeleteTarget.id })}
        loading={deleteInvoice.isPending}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete formation"
        description={`Delete "${org.name}"? It will be hidden and the owner can no longer manage it. You can permanently remove it later from the trash.`}
        onConfirm={() => deleteFormation.mutate({ id })}
        loading={deleteFormation.isPending}
      />

      <div className="grid gap-6 lg:grid-cols-2">
      {/* Company info */}
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2Icon className="size-4 text-amber-500" />
              Company Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {owner && (
              <div className="flex items-start gap-3">
                <UserIcon className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="text-sm font-medium">{owner.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{owner.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Admin Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="size-4 text-amber-500" />
            Admin Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdminSave} className="space-y-4">
            <div className="flex items-start gap-3">
              <FileTextIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <MultiSelect
                  single
                  values={[adminStatus]}
                  onValuesChange={(vals) => setAdminStatus(vals[0] ?? "pending")}
                >
                  <MultiSelectTrigger className="mt-1 h-8 w-44">
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

            {org.country === "uk" && (
              <>
                <div className="flex items-start gap-3">
                  <HashIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Company ID (Companies House)</p>
                    <Controller
                      control={adminControl}
                      name="companyId"
                      render={({ field, fieldState }) => (
                        <div className="space-y-1">
                          <Input className="mt-1 h-8 text-sm" placeholder="e.g. 12345678" {...field} />
                          {fieldState.error && (
                            <p className="text-xs text-red-500">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <HashIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Auth Code</p>
                    <Controller
                      control={adminControl}
                      name="authCode"
                      render={({ field, fieldState }) => (
                        <div className="space-y-1">
                          <Input className="mt-1 h-8 text-sm" placeholder="Enter auth code" {...field} />
                          {fieldState.error && (
                            <p className="text-xs text-red-500">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Filing deadlines are pulled automatically from Companies House.
                </p>
              </>
            )}

            {org.country === "us" && (
              <>
                <DateField control={adminControl} name="stateFilingDue" label="State Filing Due" />
                <DateField control={adminControl} name="federalFilingDue" label="Federal Filing Due" />
                <DateField control={adminControl} name="stateTaxDue" label="State Tax Due" />
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>

      {/* Companies House (UK) */}
      <CompaniesHouseCard orgId={id} />
      <OfficersCard orgId={id} />
      <FilingHistoryCard orgId={id} />

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
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {org.documents.map((doc) => {
                    const ds = docStatusBadge[doc.status] ?? docStatusBadge.requested
                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <p className="font-medium">{doc.name}</p>
                          {doc.rejectReason && (
                            <p className="mt-0.5 text-xs text-red-500">{doc.rejectReason}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ds.variant}>{ds.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {doc.value && (
                              <Button variant="outline" size="icon" className="size-8" asChild>
                                <a href={doc.value} target="_blank" rel="noopener noreferrer">
                                  <DownloadIcon className="size-4" />
                                </a>
                              </Button>
                            )}
                            {doc.status !== "requested" && (
                              <>
                                {doc.status !== "approved" && (
                                  <Button
                                    variant="default"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => reviewDoc.mutate({ documentId: doc.id, status: "approved" })}
                                    disabled={reviewDoc.isPending}
                                  >
                                    <CheckIcon className="size-4" />
                                  </Button>
                                )}
                                {doc.status !== "rejected" && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-8 text-red-500"
                                    onClick={() => setRejecting({ docId: doc.id, docName: doc.name })}
                                  >
                                    <XIcon className="size-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {doc.status === "requested" && !doc.value && (
                              <span className="text-xs text-muted-foreground">Awaiting upload</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <ReceiptIcon className="size-4 text-amber-500" />
              Invoices
            </div>
            <Button size="sm" variant="outline" onClick={() => setInvoiceModal(true)}>
              + Add Invoice
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {org.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {org.invoices.map((inv) => {
                    const is = invStatusLabel[inv.status] ?? invStatusLabel.unpaid
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <p className="font-medium">${inv.amount}</p>
                          {inv.description && (
                            <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{inv.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{inv.paymentMethod ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{inv.transactionId ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={is.variant}>{is.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === PaymentStatus.processing && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => approveInvoice.mutate({ id: inv.id })}
                                  disabled={approveInvoice.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setInvRejecting({ id: inv.id })}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button variant="outline" size="icon" className="size-8" asChild>
                              <a
                                href={`/dashboard/invoices/${inv.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Download invoice"
                              >
                                <DownloadIcon className="size-4" />
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 text-red-500"
                              title="Delete invoice"
                              onClick={() => setInvDeleteTarget({ id: inv.id })}
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <MailIcon className="size-4 text-amber-500" />
              Mail
            </div>
            <Button size="sm" variant="outline" onClick={() => setMailModal(true)}>
              + Add Mail
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!mails || mails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mail.</p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Attachments</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mails.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium">{m.subject}</p>
                        <p className="mt-0.5 max-w-md whitespace-pre-wrap text-xs text-muted-foreground">{m.body}</p>
                      </TableCell>
                      <TableCell>{m.from}</TableCell>
                      <TableCell>
                        {m.attachments.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {m.attachments.map((url, i) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <PaperclipIcon className="size-3" />
                                {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-red-500"
                          onClick={() => deleteMail.mutate({ id: m.id })}
                          disabled={deleteMail.isPending}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add mail modal */}
      {mailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Add Mail</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Record an incoming mail for this company.
            </p>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  placeholder="e.g. HM Revenue & Customs"
                  value={mailFrom}
                  onChange={(e) => setMailFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="e.g. Confirmation Statement Due"
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea
                  rows={5}
                  placeholder="Mail content…"
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Attachments</Label>
                <input
                  ref={mailFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    setMailFiles(Array.from(e.target.files ?? []))
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => mailFileRef.current?.click()}
                >
                  <PaperclipIcon className="size-3" />
                  {mailFiles.length > 0 ? `${mailFiles.length} file(s) selected` : "Attach files"}
                </Button>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setMailModal(false)
                  setMailFrom("")
                  setMailSubject("")
                  setMailBody("")
                  setMailFiles([])
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMail}
                disabled={!mailFrom || !mailSubject || !mailBody || mailUploading || createMail.isPending}
              >
                {mailUploading || createMail.isPending ? "Adding…" : "Add Mail"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add invoice modal */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Add Invoice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an unpaid invoice for this company.
            </p>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 99"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Annual confirmation statement filing"
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setInvoiceModal(false); setInvoiceAmount(""); setInvoiceDescription("") }}>
                Cancel
              </Button>
              <Button
                onClick={() => createInvoice.mutate({ organizationId: id, amount: parseFloat(invoiceAmount), description: invoiceDescription })}
                disabled={!invoiceAmount || parseFloat(invoiceAmount) <= 0 || createInvoice.isPending}
              >
                {createInvoice.isPending ? "Creating…" : "Create Invoice"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject invoice modal */}
      {invRejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 ring-1 ring-foreground/10">
            <h3 className="font-semibold text-foreground">Reject Invoice</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide a reason for rejection.
            </p>
            <Textarea
              className="mt-4"
              rows={3}
              placeholder="e.g. Invalid transaction ID"
              value={invRejectReason}
              onChange={(e) => setInvRejectReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setInvRejecting(null); setInvRejectReason("") }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectInvoice.mutate({ id: invRejecting.id, reason: invRejectReason })}
                disabled={!invRejectReason || rejectInvoice.isPending}
              >
                {rejectInvoice.isPending ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
