"use client"

import { trpc } from "@/lib/trpc/client"
import { ServiceOrderStatus } from "@/generated/prisma/enums"
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
import { ShoppingCartIcon } from "lucide-react"

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
}

export default function AdminOrdersPage() {
  const utils = trpc.useUtils()
  const { data: orders, isLoading } = trpc.serviceOrders.listAll.useQuery()
  const updateStatus = trpc.serviceOrders.updateStatus.useMutation({
    onSuccess: () => utils.serviceOrders.listAll.invalidate(),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage service orders and their status.
        </p>
      </div>

      {orders?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingCartIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((order) => {
                const sb = statusBadge[order.status] ?? statusBadge.pending
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.service?.title ?? "—"}
                    </TableCell>
                    <TableCell>${order.invoice?.amount ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.invoice?.id ? (
                        <a
                          href={`/admin/invoices`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {order.invoiceId.slice(0, 8)}…
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {order.status === ServiceOrderStatus.pending && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: ServiceOrderStatus.processing,
                              })
                            }
                            disabled={updateStatus.isPending}
                          >
                            Mark Processing
                          </Button>
                        )}
                        {order.status === ServiceOrderStatus.processing && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: ServiceOrderStatus.completed,
                              })
                            }
                            disabled={updateStatus.isPending}
                          >
                            Mark Completed
                          </Button>
                        )}
                        {order.status === ServiceOrderStatus.completed && (
                          <span className="text-xs text-green-600">Done</span>
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
    </div>
  )
}
