"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Building2Icon, ArrowRightIcon, Trash2Icon } from "lucide-react"

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

export default function AdminFormationsPage() {
  const { data: companies, isLoading } = trpc.companies.listAll.useQuery()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Formations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All company formations.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/formations/trash">
            <Trash2Icon className="size-4" />
            Trash
          </Link>
        </Button>
      </div>

      {companies?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2Icon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No formations yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies?.map((org) => {
                const sb = statusBadge[org.status] ?? statusBadge.pending
                const owner = org.members.find((m) => m.role === "owner")?.user
                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {owner?.name ?? owner?.email ?? "—"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {org.country === "uk" ? "UK" : org.country === "us" ? "US" : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {org.documents.length} docs
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="icon" className="size-8" asChild>
                        <Link href={`/admin/formations/${org.id}`}>
                          <ArrowRightIcon className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
