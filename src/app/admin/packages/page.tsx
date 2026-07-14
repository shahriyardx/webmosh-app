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
  Package,
} from "lucide-react"

export default function AdminPackagesPage() {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const utils = trpc.useUtils()
  const { data: packages, isLoading } = trpc.packages.list.useQuery()
  const deletePkg = trpc.packages.delete.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate()
      setDeleteTarget(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Packages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage formation packages and pricing.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/packages/new">
            <PlusIcon className="mr-1.5 size-4" />
            New Package
          </Link>
        </Button>
      </div>

      {packages?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Package className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No packages yet.</p>
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
              {packages?.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.title}</TableCell>
                  <TableCell>
                    {pkg.country === "uk" ? "UK" : "US"}
                  </TableCell>
                  <TableCell>${pkg.price}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="size-8" asChild>
                        <Link href={`/admin/packages/${pkg.id}/edit`}>
                          <PencilIcon className="size-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="icon" className="size-8 text-red-500" onClick={() => setDeleteTarget({ id: pkg.id, title: pkg.title })}>
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
        title="Delete Package"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`
            : ""
        }
        onConfirm={() => deleteTarget && deletePkg.mutate({ id: deleteTarget.id })}
        loading={deletePkg.isPending}
      />
    </div>
  )
}
