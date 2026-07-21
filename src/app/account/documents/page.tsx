"use client"

import { useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  FileTextIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  UploadIcon,
} from "lucide-react"

const statusConfig = {
  requested: {
    label: "Requested",
    icon: ClockIcon,
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  submitted: {
    label: "In review",
    icon: ClockIcon,
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2Icon,
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: XCircleIcon,
    className: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  },
}

function StatusPill({ status }: { status: string }) {
  const config =
    statusConfig[status as keyof typeof statusConfig] ?? statusConfig.submitted
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${config.className}`}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  )
}

type Doc = {
  id: string
  name: string
  value: string | null
  status: string
  rejectReason: string | null
  requestReason: string | null
  createdAt: Date
  organizationId: string
  organization: { id: string; name: string } | null
}

export default function AccountDocumentsPage() {
  const utils = trpc.useUtils()
  const { data: docs, isLoading } = trpc.companies.documentsForUser.useQuery()
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  const uploadDoc = trpc.companies.submitDocument.useMutation({
    onSuccess: () => {
      utils.companies.documentsForUser.invalidate()
      utils.companies.pendingDocCountForUser.invalidate()
    },
  })

  const handleUpload = async (doc: Doc, file: File) => {
    setUploading((prev) => ({ ...prev, [doc.id]: true }))
    try {
      const fd = new FormData()
      fd.append("document", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const data: { files: { name: string; url: string }[] } = await res.json()
      const uploaded = data.files?.[0]
      if (!uploaded?.url) throw new Error("No URL returned")
      await uploadDoc.mutateAsync({
        organizationId: doc.organizationId,
        documentId: doc.id,
        fileUrl: uploaded.url,
      })
    } catch {
      // error handled by UI state
    } finally {
      setUploading((prev) => ({ ...prev, [doc.id]: false }))
    }
  }

  const list = docs ?? []
  const needsActionCount = list.filter(
    (d) => d.status === "requested" || d.status === "rejected",
  ).length

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
            Documents
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            All documents across your companies.
          </p>
        </div>
        {needsActionCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
            <AlertCircleIcon className="size-3.5" />
            {needsActionCount} need{needsActionCount === 1 ? "s" : ""} your
            attention
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <FileTextIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No documents yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc as Doc}
                  uploading={uploading[doc.id] ?? false}
                  onUploadFile={(file) => handleUpload(doc as Doc, file)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DocumentRow({
  doc,
  uploading,
  onUploadFile,
}: {
  doc: Doc
  uploading: boolean
  onUploadFile: (file: File) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const needsAction = doc.status === "requested" || doc.status === "rejected"

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUploadFile(file)
      e.target.value = ""
    }
  }

  return (
    <tr className="border-b border-border last:border-0 align-middle transition-colors hover:bg-muted/30">
      {/* Document name (+ reason note) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              needsAction
                ? doc.status === "rejected"
                  ? "bg-red-500/10"
                  : "bg-amber-500/10"
                : "border border-border bg-muted/40"
            }`}
          >
            <FileTextIcon
              className={`size-4 ${
                needsAction
                  ? doc.status === "rejected"
                    ? "text-red-500"
                    : "text-amber-500"
                  : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{doc.name}</p>
            {doc.status === "rejected" && doc.rejectReason && (
              <p className="truncate text-xs text-red-600 dark:text-red-400">
                {doc.rejectReason}
              </p>
            )}
            {doc.status === "requested" && (
              <p className="truncate text-xs text-amber-600 dark:text-amber-400">
                {doc.requestReason ?? "Requested — please upload this document."}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {doc.organization?.name ?? "—"}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(doc.createdAt).toLocaleDateString()}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusPill status={doc.status} />
      </td>

      {/* Action */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {doc.value && (
            <Button variant="outline" size="sm" asChild>
              <a href={doc.value} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-3" />
                View
              </a>
            </Button>
          )}
          {(needsAction || (!doc.value && doc.status === "requested")) && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFilePick}
              />
              <Button
                variant={needsAction ? "default" : "outline"}
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-3" />
                    Upload
                  </>
                )}
              </Button>
            </>
          )}
          {!doc.value && !needsAction && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>
    </tr>
  )
}
