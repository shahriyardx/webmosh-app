"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  ConciergeBellIcon,
} from "lucide-react"

export default function AdminServicesPage() {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const utils = trpc.useUtils()
  const { data: services, isLoading } = trpc.services.list.useQuery()
  const deleteSvc = trpc.services.delete.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate()
      setDeleteTarget(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage additional services and pricing.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/services/new">
            <PlusIcon className="mr-1.5 size-4" />
            New Service
          </Link>
        </Button>
      </div>

      {services?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ConciergeBellIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No services yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.map((svc) => (
                <TableRow key={svc.id}>
                  <TableCell className="font-medium">{svc.title}</TableCell>
                  <TableCell>{svc.country === "uk" ? "UK" : "US"}</TableCell>
                  <TableCell>${svc.price}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="size-8" asChild>
                        <Link href={`/admin/services/${svc.id}/edit`}>
                          <PencilIcon className="size-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="icon" className="size-8 text-red-500" onClick={() => setDeleteTarget({ id: svc.id, title: svc.title })}>
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Service"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`
            : ""
        }
        onConfirm={() => deleteTarget && deleteSvc.mutate({ id: deleteTarget.id })}
        loading={deleteSvc.isPending}
      />
    </div>
  )
}
