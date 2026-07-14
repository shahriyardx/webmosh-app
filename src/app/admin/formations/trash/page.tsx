"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Trash2Icon, ArrowLeftIcon, RotateCcwIcon } from "lucide-react"

export default function FormationsTrashPage() {
  const utils = trpc.useUtils()
  const { data: companies, isLoading } = trpc.companies.listDeleted.useQuery()
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; name: string } | null>(null)

  const restore = trpc.companies.restoreFormation.useMutation({
    onSuccess: () => {
      utils.companies.listDeleted.invalidate()
      utils.companies.listAll.invalidate()
      toast.success("Formation restored")
    },
  })

  const purge = trpc.companies.purgeFormation.useMutation({
    onSuccess: () => {
      utils.companies.listDeleted.invalidate()
      setPurgeTarget(null)
      toast.success("Formation permanently deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/formations">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trash</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleted formations. Restore, or permanently remove (deletes all linked data).
          </p>
        </div>
      </div>

      {!companies || companies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Trash2Icon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Trash is empty.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Linked</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((org) => {
                const owner = org.members.find((m) => m.role === "owner")?.user
                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {owner?.name ?? owner?.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {org._count.invoices} inv · {org._count.documents} docs
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {org.deletedAt ? new Date(org.deletedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restore.mutate({ id: org.id })}
                          disabled={restore.isPending}
                        >
                          <RotateCcwIcon className="size-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-red-500"
                          onClick={() => setPurgeTarget({ id: org.id, name: org.name })}
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

      <DeleteConfirmDialog
        open={!!purgeTarget}
        onOpenChange={(o) => !o && setPurgeTarget(null)}
        title="Permanently delete formation"
        description={`Permanently delete "${purgeTarget?.name}"? This removes the company and ALL linked data (directors, documents, invoices, orders, mail, tickets). This cannot be undone.`}
        onConfirm={() => purgeTarget && purge.mutate({ id: purgeTarget.id })}
        loading={purge.isPending}
      />
    </div>
  )
}
