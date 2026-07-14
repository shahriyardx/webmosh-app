"use client"

import { useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  requested: { label: "Requested", icon: ClockIcon, variant: "secondary" as const },
  submitted: { label: "Submitted", icon: ClockIcon, variant: "outline" as const },
  approved: { label: "Approved", icon: CheckCircle2Icon, variant: "default" as const },
  rejected: { label: "Rejected", icon: XCircleIcon, variant: "destructive" as const },
}

function StatusBadge({ status }: { status: string }) {
  const config =
    statusConfig[status as keyof typeof statusConfig] ?? statusConfig.submitted
  const Icon = config.icon
  return (
    <Badge variant={config.variant}>
      <Icon />
      {config.label}
    </Badge>
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

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All documents across your companies.
        </p>
      </div>

      {!docs || docs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <FileTextIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
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
        variant="outline"
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-start gap-3 pt-1">
          <FileTextIcon className="size-5 shrink-0 text-sky-500" />
          <div>
            <CardTitle className="text-base">{doc.name}</CardTitle>
            {doc.organization?.name && (
              <p className="mt-0.5 text-xs uppercase text-muted-foreground">
                {doc.organization.name}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </CardHeader>
      <CardContent>
        {doc.status === "rejected" && doc.rejectReason && (
          <p className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircleIcon className="size-3" />
            {doc.rejectReason}
          </p>
        )}
        {doc.status === "submitted" && (
          <p className="text-xs text-muted-foreground">
            Document pending review by admin.
          </p>
        )}
        {doc.status === "requested" && (
          <p className="text-xs text-muted-foreground">
            {doc.requestReason ??
              "This document has been requested. Please upload it below."}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border pt-4">
        {doc.status === "requested" && !doc.value ? (
          uploadButton
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Uploaded {new Date(doc.createdAt).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2">
              {doc.value && (
                <Button variant="outline" asChild>
                  <a href={doc.value} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-3" />
                    View file
                  </a>
                </Button>
              )}
              {needsAction && uploadButton}
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
