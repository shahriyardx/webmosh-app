"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ClipboardListIcon,
  CheckCircle2Icon,
  Loader2Icon,
  AlertOctagonIcon,
  ClockIcon,
  ArrowRightIcon,
  WalletIcon,
  HourglassIcon,
  BanknoteIcon,
} from "lucide-react"

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

export default function FreelancerDashboardPage() {
  const { data: stats } = trpc.tasks.myStats.useQuery()
  const { data: tasks } = trpc.tasks.listMine.useQuery()
  const { data: balance } = trpc.tasks.myBalance.useQuery()

  const openTasks = (tasks ?? []).filter((t) => t.status !== "done")
  const topFive = openTasks.slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your open work at a glance.
        </p>
      </div>

      {/* Balance hero */}
      <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-background">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <WalletIcon className="size-4 text-emerald-500" />
              Available
            </div>
            <p className="mt-2 text-3xl font-bold text-emerald-500">
              ${(balance?.available ?? 0).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ready to withdraw
            </p>
            <Button size="sm" variant="outline" asChild className="mt-3">
              <Link href="/freelancer/payouts">
                Request payout
                <ArrowRightIcon className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <ClockIcon className="size-4 text-amber-500" />
              Awaiting approval
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              ${(balance?.requested ?? 0).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              In review by admin
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <HourglassIcon className="size-4 text-amber-500" />
              Pipeline
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              ${(balance?.pending ?? 0).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlocks as you complete tasks
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <BanknoteIcon className="size-4 text-sky-500" />
              Paid out
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              ${(balance?.paidOut ?? 0).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lifetime withdrawn
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardListIcon className="size-5 text-sky-500" />}
          label="Total tasks"
          value={stats?.total ?? 0}
        />
        <StatCard
          icon={<ClockIcon className="size-5 text-amber-500" />}
          label="To do"
          value={stats?.todo ?? 0}
        />
        <StatCard
          icon={<Loader2Icon className="size-5 text-sky-500" />}
          label="In progress"
          value={stats?.in_progress ?? 0}
        />
        <StatCard
          icon={<CheckCircle2Icon className="size-5 text-emerald-500" />}
          label="Done"
          value={stats?.done ?? 0}
        />
      </div>

      {(stats?.blocked ?? 0) > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertOctagonIcon className="size-5 text-red-500" />
            <div>
              <p className="text-sm font-medium">
                {stats?.blocked} task{stats?.blocked === 1 ? "" : "s"} blocked
              </p>
              <p className="text-xs text-muted-foreground">
                Reach out to admin to unblock.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Up next</span>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/freelancer/tasks">
                View all
                <ArrowRightIcon className="ml-1 size-3" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!topFive.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up. Nice work.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {topFive.map((t) => (
                <Link
                  key={t.id}
                  href={`/freelancer/tasks/${t.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:opacity-80"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.organization?.name ??
                        t.order?.service?.title ??
                        "Standalone task"}
                      {t.deadline
                        ? ` · Due ${new Date(t.deadline).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
                        priorityStyles[t.priority]
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
                        statusStyles[t.status]
                      }`}
                    >
                      {statusLabels[t.status]}
                    </span>
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
