"use client"

import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileTextIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  AlertCircleIcon,
} from "lucide-react"

const statusConfig = {
  submitted: {
    label: "Submitted",
    icon: ClockIcon,
    variant: "outline" as const,
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2Icon,
    variant: "default" as const,
  },
  rejected: {
    label: "Rejected",
    icon: XCircleIcon,
    variant: "destructive" as const,
  },
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

export default function DocumentsPage() {
  const { data: session } = authClient.useSession()
  const activeOrgId = session?.session?.activeOrganizationId

  const { data: org, isLoading } = trpc.companies.getOverview.useQuery(
    { orgId: activeOrgId ?? "" },
    { enabled: !!activeOrgId },
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

  const documents = org.documents ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground uppercase">
          {org.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Documents</p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <FileTextIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="flex items-start gap-3 pt-1">
                  <FileTextIcon className="size-5 shrink-0 text-amber-500" />
                  <div>
                    <CardTitle className="text-base">{doc.name}</CardTitle>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-muted-foreground">
                    Uploaded{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                  {doc.value && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      asChild
                    >
                      <a
                        href={doc.value}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLinkIcon className="size-3" />
                        View file
                      </a>
                    </Button>
                  )}
                </div>

                {doc.rejectReason && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-red-500">
                    <AlertCircleIcon className="size-3" />
                    {doc.rejectReason}
                  </p>
                )}

                {doc.status === "submitted" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Document pending review by admin.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
