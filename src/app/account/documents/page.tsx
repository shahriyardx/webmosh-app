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

  const needsActionCount = (docs ?? []).filter(
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
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

      {!docs || docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <FileTextIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No documents yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc as Doc}
              uploading={uploading[doc.id] ?? false}
              onUploadFile={(file) => handleUpload(doc as Doc, file)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentCard({
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

  const uploadButton = (
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
            Upload file
          </>
        )}
      </Button>
    </>
  )

  return (
    <div
      className={`rounded-2xl border bg-card p-5 transition-colors ${
        needsAction
          ? doc.status === "rejected"
            ? "border-red-500/30"
            : "border-amber-500/30"
          : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
              needsAction
                ? doc.status === "rejected"
                  ? "bg-red-500/10"
                  : "bg-amber-500/10"
                : "border border-border bg-muted/40"
            }`}
          >
            <FileTextIcon
              className={`size-5 ${
                needsAction
                  ? doc.status === "rejected"
                    ? "text-red-500"
                    : "text-amber-500"
                  : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {doc.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {doc.organization?.name && (
                <span className="uppercase tracking-wide">
                  {doc.organization.name}
                </span>
              )}
              {doc.organization?.name && " · "}
              {new Date(doc.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <StatusPill status={doc.status} />
      </div>

      {doc.status === "rejected" && doc.rejectReason && (
        <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{doc.rejectReason}</span>
        </div>
      )}
      {doc.status === "requested" && (
        <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {doc.requestReason ??
              "This document has been requested. Please upload it below."}
          </span>
        </div>
      )}
      {doc.status === "submitted" && (
        <p className="mt-3.5 text-xs text-muted-foreground">
          Document pending review by our team.
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
        {doc.value && (
          <Button variant="outline" size="sm" asChild>
            <a href={doc.value} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon className="size-3" />
              View file
            </a>
          </Button>
        )}
        {(needsAction || (!doc.value && doc.status === "requested")) &&
          uploadButton}
      </div>
    </div>
  )
}
