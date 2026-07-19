"use client"

import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { TaskStatus } from "@/generated/prisma/enums"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ClipboardListIcon,
  CheckCircle2Icon,
  Loader2Icon,
  AlertOctagonIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  WalletIcon,
  HourglassIcon,
  BanknoteIcon,
  MessagesSquareIcon,
  type LucideIcon,
} from "lucide-react"

const statusStyles: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground ring-border",
  in_progress:
    "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
}

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"
}

export default function FreelancerDashboardPage() {
  const { data: session } = authClient.useSession()
  const { data: stats } = trpc.tasks.myStats.useQuery()
  const { data: tasks } = trpc.tasks.listMine.useQuery()
  const { data: balance } = trpc.tasks.myBalance.useQuery()
  const { data: threads } = trpc.discussions.myThreads.useQuery()

  const firstName = session?.user?.name?.split(" ")[0] ?? "there"
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const recentTasks = (tasks ?? []).slice(0, 5)
  const recentThreads = (threads ?? [])
    .filter((t) => t.lastMessage)
    .slice(0, 5)

  const statCards: {
    label: string
    value: number
    icon: LucideIcon
    tint: string
  }[] = [
    {
      label: "Total tasks",
      value: stats?.total ?? 0,
      icon: ClipboardListIcon,
      tint: "text-sky-500",
    },
    {
      label: "To do",
      value: stats?.todo ?? 0,
      icon: ClockIcon,
      tint: "text-amber-500",
    },
    {
      label: "In progress",
      value: stats?.in_progress ?? 0,
      icon: Loader2Icon,
      tint: "text-violet-500",
    },
    {
      label: "Done",
      value: stats?.done ?? 0,
      icon: CheckCircle2Icon,
      tint: "text-emerald-500",
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sky-600 dark:text-sky-400">
            {today}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {firstName} <span className="ml-1">👋</span>
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            Here&apos;s your workspace at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/freelancer/discussions">
              <MessagesSquareIcon className="size-4" />
              Discussions
            </Link>
          </Button>
          <Button asChild>
            <Link href="/freelancer/tasks">
              <ClipboardListIcon className="size-4" />
              My tasks
            </Link>
          </Button>
        </div>
      </div>

      {/* Earnings hero */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <WalletIcon className="size-4" />
              Available to withdraw
            </p>
            <p className="mt-2 text-5xl font-bold tracking-tight text-emerald-400">
              ${(balance?.available ?? 0).toFixed(2)}
              <span className="ml-2 align-middle text-base font-medium text-slate-400">
                USD
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Button
                asChild
                className="bg-white text-slate-900 shadow-none hover:bg-slate-200"
              >
                <Link href="/freelancer/payouts">
                  <BanknoteIcon className="size-4" />
                  Request payout
                </Link>
              </Button>
              <Button
                asChild
                className="border border-white/15 bg-white/5 text-white shadow-none backdrop-blur hover:bg-white/15"
              >
                <Link href="/freelancer/payouts">
                  Payout history
                  <ArrowUpRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-inset ring-white/10">
            <HeroStat
              icon={ClockIcon}
              label="Awaiting"
              value={balance?.requested ?? 0}
              hint="In review"
            />
            <HeroStat
              icon={HourglassIcon}
              label="Pipeline"
              value={balance?.pending ?? 0}
              hint="Open tasks"
            />
            <HeroStat
              icon={BanknoteIcon}
              label="Paid out"
              value={balance?.paidOut ?? 0}
              hint="Lifetime"
            />
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </p>
                <s.icon className={`size-4 ${s.tint}`} />
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {(stats?.blocked ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
            <AlertOctagonIcon className="size-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {stats?.blocked} task{stats?.blocked === 1 ? "" : "s"} blocked
            </p>
            <p className="text-xs text-muted-foreground">
              Reach out to admin to unblock and keep your pipeline moving.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/freelancer/discussions">
              Message admin
              <ArrowRightIcon className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent discussions */}
        <Card className="rounded-2xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
                <MessagesSquareIcon className="size-4 text-muted-foreground" />
              </div>
              Recent discussions
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/freelancer/discussions">
                View all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentThreads.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="mb-1 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
                  <MessagesSquareIcon className="size-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No discussions yet.
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Start a chat with admin from any task.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentThreads.map((t) => (
                  <Link
                    key={t.id}
                    href={`/freelancer/discussions?task=${t.id}`}
                    className="group flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-500">
                      {t.lastMessage?.fromAdmin
                        ? "AD"
                        : initials(session?.user?.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.lastMessage?.fromAdmin ? "Admin: " : "You: "}
                        {t.lastMessage?.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.unread > 0 && (
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                          {t.unread}
                        </span>
                      )}
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tasks */}
        <Card className="rounded-2xl shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40">
                <ClipboardListIcon className="size-4 text-muted-foreground" />
              </div>
              Recent tasks
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/freelancer/tasks">
                View all
                <ArrowRightIcon className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentTasks.length ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="mb-1 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
                  <ClipboardListIcon className="size-6 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No tasks assigned yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/freelancer/tasks/${t.id}`}
                    className="group flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {t.title}
                      </p>
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
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          statusStyles[t.status]
                        }`}
                      >
                        {statusLabels[t.status]}
                      </span>
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="bg-slate-950 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-white">
        ${value.toFixed(2)}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  )
}
