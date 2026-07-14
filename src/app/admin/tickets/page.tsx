"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { TicketStatus } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LifeBuoyIcon } from "lucide-react"

const tabs = [
  { label: "All", value: undefined },
  { label: "Open", value: TicketStatus.open },
  { label: "Awaiting reply", value: TicketStatus.pending },
  { label: "Closed", value: TicketStatus.closed },
] as const

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  open: { label: "Open", variant: "default" },
  pending: { label: "Awaiting reply", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
}

export default function AdminTicketsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<TicketStatus | undefined>(undefined)
  const { data: tickets, isLoading } = trpc.tickets.listAll.useQuery({ status })

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
        <h1 className="text-2xl font-semibold text-foreground">Support Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Respond to and manage customer support tickets.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-sky-500/10 text-sky-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!tickets || tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <LifeBuoyIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tickets found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => {
                const sb = statusBadge[t.status] ?? statusBadge.open
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/tickets/${t.id}`)}
                  >
                    <TableCell className="font-medium">{t.subject}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.organization?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.user?.name ?? "—"}
                      <span className="block text-xs">{t.user?.email}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t._count.messages}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(t.updatedAt).toLocaleDateString()}
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
