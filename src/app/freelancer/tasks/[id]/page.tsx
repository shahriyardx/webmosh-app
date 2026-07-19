"use client"

import { use, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  ClipboardListIcon,
  CalendarClockIcon,
  BuildingIcon,
  PaletteIcon,
  Globe2Icon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  KeyRoundIcon,
  ServerIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  AlertOctagonIcon,
  CheckCircle2Icon,
  MessagesSquareIcon,
} from "lucide-react"

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-500 ring-amber-500/25",
  high: "bg-red-500/15 text-red-500 ring-red-500/25",
}

type StatusMeta = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  activeClass: string
}

const statusMeta: Record<TaskStatus, StatusMeta> = {
  todo: {
    label: "To do",
    icon: ClockIcon,
    activeClass: "bg-muted text-foreground ring-border",
  },
  in_progress: {
    label: "In progress",
    icon: Loader2Icon,
    activeClass: "bg-sky-500/15 text-sky-500 ring-sky-500/25",
  },
  blocked: {
    label: "Blocked",
    icon: AlertOctagonIcon,
    activeClass: "bg-red-500/15 text-red-500 ring-red-500/25",
  },
  done: {
    label: "Done",
    icon: CheckCircle2Icon,
    activeClass: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25",
  },
}

type CredentialSection = {
  url?: string
  username?: string
  password?: string
}

type OrderCredentials = {
  cpanel?: CredentialSection
  wpAdmin?: CredentialSection
}

function formatDeadline(deadline: Date | string | null) {
  if (!deadline) return null
  const d = new Date(deadline)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const abs = Math.abs(diffDays)
  let phrase: string
  let tone: "amber" | "red" | "muted"
  if (diffDays < 0) {
    phrase = `Overdue by ${abs} day${abs === 1 ? "" : "s"}`
    tone = "red"
  } else if (diffDays === 0) {
    phrase = "Due today"
    tone = "red"
  } else if (diffDays <= 3) {
    phrase = `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`
    tone = "amber"
  } else {
    phrase = `Due ${d.toLocaleDateString()}`
    tone = "muted"
  }
  return { phrase, tone, dateLabel: d.toLocaleDateString() }
}

export default function FreelancerTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const utils = trpc.useUtils()
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id })

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id })
      utils.tasks.listMine.invalidate()
      utils.tasks.myStats.invalidate()
      utils.tasks.myBalance.invalidate()
      utils.payouts.myBalance.invalidate()
      toast.success("Status updated")
    },
    onError: (err) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Task not found.</p>
      </div>
    )
  }

  const creds = (task.order?.credentials as OrderCredentials | null) ?? null
  const deadline = formatDeadline(task.deadline)
  const currentStatus = statusMeta[task.status]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Back link */}
      <Link
        href="/freelancer/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All tasks
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-sky-500/5 via-background to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset ${
                  priorityStyles[task.priority]
                }`}
              >
                {task.priority} priority
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${currentStatus.activeClass}`}
              >
                <currentStatus.icon className="size-3" />
                {currentStatus.label}
              </span>
              {task.payoutAmount != null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    task.status === "done"
                      ? "bg-emerald-500/15 text-emerald-500 ring-emerald-500/25"
                      : "bg-muted text-foreground ring-border"
                  }`}
                >
                  ${task.payoutAmount.toFixed(2)}
                  {task.status === "done" ? " earned" : " on completion"}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {task.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClockIcon className="size-4" />
                Assigned {new Date(task.createdAt).toLocaleDateString()}
              </span>
              {deadline && (
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    deadline.tone === "red"
                      ? "text-red-500"
                      : deadline.tone === "amber"
                      ? "text-amber-500"
                      : ""
                  }`}
                >
                  <ClockIcon className="size-4" />
                  {deadline.phrase}
                </span>
              )}
              {task.organization && (
                <span className="inline-flex items-center gap-1.5">
                  <BuildingIcon className="size-4" />
                  <span className="uppercase">{task.organization.name}</span>
                </span>
              )}
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href={`/freelancer/discussions?task=${task.id}`}>
              <MessagesSquareIcon className="size-4" />
              Discuss with admin
            </Link>
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-2">
                <ClipboardListIcon className="size-4 text-sky-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">
                  Description
                </h2>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {task.description}
              </p>
            </CardContent>
          </Card>

          {/* Website details */}
          {task.order &&
            (task.order.contactCompany ||
              task.order.contactAddress ||
              task.order.contactEmail ||
              task.order.contactPhone) && (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-2">
                    <Globe2Icon className="size-4 text-sky-500" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider">
                      Website details
                    </h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldRow
                      icon={<BuildingIcon className="size-4" />}
                      label="Company"
                      value={task.order.contactCompany}
                    />
                    <FieldRow
                      icon={<MailIcon className="size-4" />}
                      label="Email"
                      value={task.order.contactEmail}
                      copyable
                    />
                    <FieldRow
                      icon={<PhoneIcon className="size-4" />}
                      label="Phone"
                      value={task.order.contactPhone}
                      copyable
                    />
                    <FieldRow
                      icon={<MapPinIcon className="size-4" />}
                      label="Address"
                      value={task.order.contactAddress}
                      multiline
                    />
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Hosting access */}
          {creds && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <KeyRoundIcon className="size-4 text-sky-500" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">
                    Hosting access
                  </h2>
                </div>
                <CredsBlock label="cPanel" section={creds.cpanel} />
                <CredsBlock label="WP-admin" section={creds.wpAdmin} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status control */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Update status
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(statusMeta) as TaskStatus[]).map((key) => {
                  const meta = statusMeta[key]
                  const isActive = task.status === key
                  const disabled = updateStatus.isPending
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        !isActive &&
                        updateStatus.mutate({ id: task.id, status: key })
                      }
                      disabled={disabled}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm font-medium transition-colors ${
                        isActive
                          ? `border-transparent ${meta.activeClass} ring-1 ring-inset`
                          : "border-border hover:bg-muted/60"
                      } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <meta.icon
                        className={`size-4 shrink-0 ${
                          key === "in_progress" && isActive
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                      <span className="truncate">{meta.label}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Context */}
          {(task.organization || task.order) && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Context
                </h2>
                {task.order?.service && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Service
                    </p>
                    <p className="text-sm font-medium">
                      {task.order.service.title}
                    </p>
                  </div>
                )}
                {task.organization && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Client company
                    </p>
                    <p className="text-sm font-medium uppercase">
                      {task.organization.name}
                    </p>
                    {task.organization.country && (
                      <p className="text-xs uppercase text-muted-foreground">
                        {task.organization.country}
                      </p>
                    )}
                  </div>
                )}
                {task.order?.theme && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Theme
                    </p>
                    {task.order.theme.image ? (
                      <div className="overflow-hidden rounded-lg border border-border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={task.order.theme.image}
                          alt={task.order.theme.title}
                          className="aspect-video w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <p className="text-sm font-medium">
                      {task.order.theme.title}
                    </p>
                    {task.order.theme.demoUrl && (
                      <a
                        href={task.order.theme.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-500 hover:underline"
                      >
                        <PaletteIcon className="size-3" />
                        View demo
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </div>
                )}
                {task.order?.customDesignUrl && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Custom design
                    </p>
                    <a
                      href={task.order.customDesignUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-xs text-sky-500 hover:underline"
                    >
                      {task.order.customDesignUrl}
                      <ExternalLinkIcon className="size-3 shrink-0" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldRow({
  icon,
  label,
  value,
  copyable,
  multiline,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  copyable?: boolean
  multiline?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-start gap-2">
        <p
          className={`min-w-0 flex-1 text-sm ${
            multiline ? "whitespace-pre-wrap" : "truncate"
          }`}
        >
          {value || "—"}
        </p>
        {copyable && value && (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`Copy ${label.toLowerCase()}`}
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-emerald-500" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function CredsBlock({
  label,
  section,
}: {
  label: string
  section: CredentialSection | undefined
}) {
  const [showPassword, setShowPassword] = useState(false)
  const anyValue =
    !!section && (!!section.url || !!section.username || !!section.password)
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ServerIcon className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wider">
          {label}
        </p>
      </div>
      {!anyValue ? (
        <p className="text-sm text-muted-foreground">Not provided.</p>
      ) : (
        <div className="space-y-3">
          <CredRow label="URL" value={section?.url} />
          <CredRow label="Username" value={section?.username} />
          <CredRow
            label="Password"
            value={section?.password}
            secret
            revealed={showPassword}
            onToggleReveal={() => setShowPassword((v) => !v)}
          />
        </div>
      )}
    </div>
  )
}

function CredRow({
  label,
  value,
  secret,
  revealed,
  onToggleReveal,
}: {
  label: string
  value: string | undefined
  secret?: boolean
  revealed?: boolean
  onToggleReveal?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(false), 1500)
  }
  const displayValue = !value
    ? "—"
    : secret && !revealed
    ? "•".repeat(Math.min(value.length, 12))
    : value
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 flex-1 break-all font-mono text-xs">
        {displayValue}
      </div>
      {value && (
        <div className="flex shrink-0 items-center gap-0.5">
          {secret && onToggleReveal && (
            <button
              type="button"
              onClick={onToggleReveal}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={revealed ? "Hide" : "Reveal"}
            >
              {revealed ? (
                <EyeOffIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={`Copy ${label.toLowerCase()}`}
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-emerald-500" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
