"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import {
  ClipboardListIcon,
  CalendarClockIcon,
  BanknoteIcon,
  Building2Icon,
  PaletteIcon,
  Globe2Icon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  KeyRoundIcon,
  ServerIcon,
  CopyIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  Loader2Icon,
  ArrowUpRightIcon,
} from "lucide-react"

const statusStyles: Record<string, string> = {
  todo: "bg-muted text-muted-foreground ring-border",
  in_progress: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
}
const statusLabels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
}
const priorityStyles: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  high: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
}

type CredSection = { url?: string; username?: string; password?: string }
type OrderCredentials = { cpanel?: CredSection; wpAdmin?: CredSection }

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        toast.success("Copied")
        setTimeout(() => setCopied(false), 1200)
      }}
      className="text-muted-foreground transition-colors hover:text-foreground"
      title="Copy"
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-emerald-500" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  )
}

function Field({
  label,
  value,
  mono,
  copy,
}: {
  label: string
  value?: string | null
  mono?: boolean
  copy?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right">
        <span
          className={`truncate text-xs font-medium ${mono ? "font-mono" : ""}`}
        >
          {value}
        </span>
        {copy && <CopyBtn value={value} />}
      </span>
    </div>
  )
}

function PasswordField({ value }: { value?: string }) {
  const [show, setShow] = useState(false)
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">Password</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-xs font-medium">
          {show ? value : "••••••••"}
        </span>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-muted-foreground hover:text-foreground"
          title={show ? "Hide" : "Show"}
        >
          {show ? (
            <EyeOffIcon className="size-3.5" />
          ) : (
            <EyeIcon className="size-3.5" />
          )}
        </button>
        <CopyBtn value={value} />
      </span>
    </div>
  )
}

function CredBlock({
  icon: Icon,
  title,
  cred,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  cred?: CredSection
}) {
  if (!cred || (!cred.url && !cred.username && !cred.password)) return null
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-sky-500" />
        {title}
      </div>
      <div className="space-y-1.5">
        {cred.url && (
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">URL</span>
            <a
              href={cred.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-sky-500 hover:underline"
            >
              <span className="truncate">{cred.url}</span>
              <ExternalLinkIcon className="size-3 shrink-0" />
            </a>
          </div>
        )}
        <Field label="Username" value={cred.username} mono copy />
        <PasswordField value={cred.password} />
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * Full task details for the currently open discussion, shown as a side card.
 * Fetches via tasks.getById (admin, or the assigned freelancer).
 */
export function TaskDetailsPanel({
  taskId,
  taskHref,
}: {
  taskId: string
  taskHref?: string
}) {
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id: taskId })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!task) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Task details unavailable.
      </div>
    )
  }

  const creds = (task.order?.credentials ?? null) as OrderCredentials | null
  const deadline = task.deadline ? new Date(task.deadline) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardListIcon className="size-4 text-sky-500" />
          Task details
        </div>
        {taskHref && (
          <Link
            href={taskHref}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-sky-500"
          >
            Open
            <ArrowUpRightIcon className="size-3" />
          </Link>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Title + status */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                statusStyles[task.status] ?? statusStyles.todo
              }`}
            >
              {statusLabels[task.status] ?? task.status}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                priorityStyles[task.priority] ?? priorityStyles.medium
              }`}
            >
              {task.priority}
            </span>
          </div>
        </div>

        {/* Key facts */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          {task.payoutAmount != null && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BanknoteIcon className="size-3.5" />
                Payment
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ${task.payoutAmount.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" />
              Deadline
            </span>
            <span className="text-xs font-medium">
              {deadline ? deadline.toLocaleDateString() : "No deadline"}
            </span>
          </div>
          {task.assignedTo && (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClipboardListIcon className="size-3.5" />
                Assignee
              </span>
              <span className="truncate text-xs font-medium">
                {task.assignedTo.name}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="space-y-1.5">
            <SectionLabel>Description</SectionLabel>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {task.description}
            </p>
          </div>
        )}

        {/* Project links */}
        {(task.organization ||
          task.order?.service ||
          task.order?.theme ||
          task.order?.customDesignUrl) && (
          <div className="space-y-2">
            <SectionLabel>Project</SectionLabel>
            <div className="space-y-2 rounded-lg border border-border p-3">
              {task.organization && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2Icon className="size-3.5" />
                    Company
                  </span>
                  <span className="truncate text-xs font-medium uppercase">
                    {task.organization.name}
                  </span>
                </div>
              )}
              {task.order?.service && (
                <Field label="Service" value={task.order.service.title} />
              )}
              {task.order?.theme && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PaletteIcon className="size-3.5" />
                    Theme
                  </span>
                  <span className="truncate text-xs font-medium">
                    {task.order.theme.title}
                  </span>
                </div>
              )}
              {task.order?.customDesignUrl && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe2Icon className="size-3.5" />
                    Design
                  </span>
                  <a
                    href={task.order.customDesignUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-sky-500 hover:underline"
                  >
                    <span className="truncate">
                      {task.order.customDesignUrl}
                    </span>
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Website details / contact */}
        {task.order &&
          (task.order.contactCompany ||
            task.order.contactEmail ||
            task.order.contactPhone ||
            task.order.contactAddress) && (
            <div className="space-y-2">
              <SectionLabel>Website details</SectionLabel>
              <div className="space-y-1.5 rounded-lg border border-border p-3">
                <Field label="Company" value={task.order.contactCompany} copy />
                {task.order.contactEmail && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MailIcon className="size-3.5" />
                      Email
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-medium">
                        {task.order.contactEmail}
                      </span>
                      <CopyBtn value={task.order.contactEmail} />
                    </span>
                  </div>
                )}
                {task.order.contactPhone && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <PhoneIcon className="size-3.5" />
                      Phone
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-medium">
                        {task.order.contactPhone}
                      </span>
                      <CopyBtn value={task.order.contactPhone} />
                    </span>
                  </div>
                )}
                {task.order.contactAddress && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPinIcon className="size-3.5" />
                      Address
                    </span>
                    <span className="max-w-[60%] text-right text-xs font-medium">
                      {task.order.contactAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Credentials */}
        {creds && (creds.cpanel || creds.wpAdmin) && (
          <div className="space-y-2">
            <SectionLabel>Access credentials</SectionLabel>
            <CredBlock icon={ServerIcon} title="cPanel" cred={creds.cpanel} />
            <CredBlock
              icon={KeyRoundIcon}
              title="WordPress Admin"
              cred={creds.wpAdmin}
            />
          </div>
        )}
      </div>
    </div>
  )
}
