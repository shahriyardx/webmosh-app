"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { uploadFiles } from "@/lib/upload"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
} from "@/components/ui/multi-select"
import {
  LifeBuoyIcon,
  PlusIcon,
  PaperclipIcon,
  XIcon,
  ArrowRightIcon,
  MessageSquareIcon,
} from "lucide-react"

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  },
  pending: {
    label: "Awaiting reply",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  },
  closed: {
    label: "Closed",
    className: "bg-muted text-muted-foreground ring-border",
  },
}

const GENERAL = "__general__"

export default function AccountTicketsPage() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: ticketsData, isLoading } = trpc.tickets.list.useQuery(undefined)
  const { data: companies } = trpc.companies.myCompanies.useQuery()

  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [orgId, setOrgId] = useState<string>(GENERAL)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = trpc.tickets.create.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate()
      utils.tickets.openCount.invalidate()
      utils.tickets.pendingCount.invalidate()
      setOpen(false)
      setSubject("")
      setBody("")
      setOrgId(GENERAL)
      setFiles([])
      toast.success("Ticket created")
    },
  })

  const handleCreate = async () => {
    setUploading(true)
    try {
      const attachments = await uploadFiles(files, "ticket")
      await create.mutateAsync({
        subject,
        body,
        attachments,
        organizationId: orgId === GENERAL ? undefined : orgId,
      })
    } catch {
      toast.error("Failed to create ticket")
    } finally {
      setUploading(false)
    }
  }

  const tickets = ticketsData ?? []
  const openCount = tickets.filter((t) => t.status === "open").length
  const pendingCount = tickets.filter((t) => t.status === "pending").length
  const closedCount = tickets.filter((t) => t.status === "closed").length

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Support
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            All support tickets across your companies.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="size-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <MultiSelect
                  single
                  values={[orgId]}
                  onValuesChange={(vals) => setOrgId(vals[0] ?? GENERAL)}
                >
                  <MultiSelectTrigger className="w-full">
                    <MultiSelectValue placeholder="General question" />
                  </MultiSelectTrigger>
                  <MultiSelectContent>
                    <MultiSelectItem value={GENERAL}>General (no company)</MultiSelectItem>
                    {(companies ?? []).map((o) => (
                      <MultiSelectItem key={o.id} value={o.id}>
                        {o.name}
                      </MultiSelectItem>
                    ))}
                  </MultiSelectContent>
                </MultiSelect>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="e.g. Issue with document upload"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  rows={5}
                  placeholder="Describe your issue…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Attachments</Label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? [])
                    if (picked.length > 3) {
                      toast.error("You can attach up to 3 files")
                      setFiles(picked.slice(0, 3))
                    } else {
                      setFiles(picked)
                    }
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <PaperclipIcon className="size-3" />
                  Attach Files
                </Button>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                      >
                        <PaperclipIcon className="size-3 shrink-0" />
                        <span className="max-w-[12rem] truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!subject || !body || uploading || create.isPending}
              >
                {uploading || create.isPending ? "Creating…" : "Create Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <LifeBuoyIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No tickets yet.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Need a hand? Open a ticket and our team will get back to you.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
            <Stat label="Total tickets" value={String(tickets.length)} />
            <Stat
              label="Open"
              value={String(openCount)}
              valueClass="text-emerald-600 dark:text-emerald-400"
            />
            <Stat
              label="Awaiting reply"
              value={String(pendingCount)}
              valueClass={
                pendingCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : undefined
              }
            />
            <Stat label="Closed" value={String(closedCount)} />
          </div>

          <div className="grid gap-3">
            {tickets.map((t) => {
              const st = STATUS_STYLES[t.status] ?? STATUS_STYLES.open
              const isClosed = t.status === "closed"
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/account/tickets/${t.id}`)}
                  className={`group flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-sky-500/40 hover:bg-muted/30 ${
                    isClosed ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                        isClosed
                          ? "border border-border bg-muted/40"
                          : "bg-sky-500/10"
                      }`}
                    >
                      <LifeBuoyIcon
                        className={`size-5 ${
                          isClosed ? "text-muted-foreground" : "text-sky-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {t.subject}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">
                          {t.organization?.name ?? "General"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquareIcon className="size-3" />
                          {t._count.messages}{" "}
                          {t._count.messages === 1 ? "message" : "messages"}
                        </span>
                        <span>
                          Updated {new Date(t.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${st.className}`}
                    >
                      {st.label}
                    </span>
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums text-foreground ${valueClass ?? ""}`}
      >
        {value}
      </p>
    </div>
  )
}
