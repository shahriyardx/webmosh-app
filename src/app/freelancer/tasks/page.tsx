"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClipboardListIcon, ArrowRightIcon } from "lucide-react"

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  high: "bg-red-500/15 text-red-500 ring-red-500/25",
}

const statusStyles: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground ring-border",
  in_progress: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  blocked: "bg-red-500/15 text-red-500 ring-red-500/25",
  done: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
}

export default function FreelancerTasksPage() {
  const { data: tasks, isLoading } = trpc.tasks.listMine.useQuery()

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
        <h1 className="text-2xl font-semibold text-foreground">My Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All tasks assigned to you, sorted by status and deadline.
        </p>
      </div>

      {!tasks?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ClipboardListIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No tasks assigned yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Linked</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/freelancer/tasks/${t.id}`}
                      className="hover:underline"
                    >
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
                        priorityStyles[t.priority]
                      }`}
                    >
                      {t.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
                        statusStyles[t.status]
                      }`}
                    >
                      {statusLabels[t.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.deadline
                      ? new Date(t.deadline).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.payoutAmount != null ? (
                      <span
                        className={
                          t.status === "done"
                            ? "font-semibold text-emerald-500"
                            : "font-medium"
                        }
                      >
                        ${t.payoutAmount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.organization?.name ?? t.order?.service?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/freelancer/tasks/${t.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
