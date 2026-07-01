"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { uploadFiles } from "@/lib/upload"
import { toast } from "sonner"
import { TicketStatus } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
} from "@/components/ui/multi-select"
import { ArrowLeftIcon, PaperclipIcon, XIcon } from "lucide-react"

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  open: { label: "Open", variant: "default" },
  pending: { label: "Awaiting reply", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
}

export function TicketThread({
  ticketId,
  admin = false,
  backHref,
}: {
  ticketId: string
  admin?: boolean
  backHref: string
}) {
  const utils = trpc.useUtils()
  const { data: ticket, isLoading } = trpc.tickets.getById.useQuery({ id: ticketId })
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const invalidate = () => {
    utils.tickets.getById.invalidate({ id: ticketId })
    utils.tickets.list.invalidate()
    utils.tickets.listAll.invalidate()
    utils.tickets.openCount.invalidate()
    utils.tickets.pendingCount.invalidate()
    utils.tickets.adminOpenCount.invalidate()
  }

  const reply = trpc.tickets.reply.useMutation({
    onSuccess: () => {
      invalidate()
      setBody("")
      setFiles([])
    },
    onError: (e) => toast.error(e.message),
  })

  const handleReply = async () => {
    setUploading(true)
    try {
      const attachments = await uploadFiles(files, "ticket")
      await reply.mutateAsync({ ticketId, body, attachments })
    } catch {
      toast.error("Failed to send reply")
    } finally {
      setUploading(false)
    }
  }

  const updateStatus = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Status updated")
    },
  })

  const close = trpc.tickets.close.useMutation({
    onSuccess: () => {
      invalidate()
      toast.success("Ticket closed")
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Ticket not found.</p>
      </div>
    )
  }

  const sb = statusBadge[ticket.status] ?? statusBadge.open
  const isClosed = ticket.status === TicketStatus.closed

  const statusDropdown = (
    <MultiSelect
      single
      values={[ticket.status]}
      onValuesChange={(vals) => {
        const next = vals[0]
        if (next && next !== ticket.status) {
          updateStatus.mutate({ id: ticketId, status: next as TicketStatus })
        }
      }}
    >
      <MultiSelectTrigger className="h-9 w-44">
        <MultiSelectValue />
      </MultiSelectTrigger>
      <MultiSelectContent>
        <MultiSelectItem value="open">Open</MultiSelectItem>
        <MultiSelectItem value="pending">Awaiting reply</MultiSelectItem>
        <MultiSelectItem value="closed">Closed</MultiSelectItem>
      </MultiSelectContent>
    </MultiSelect>
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href={backHref}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{ticket.subject}</h1>
          {admin && (
            <p className="text-xs text-muted-foreground">
              {ticket.user?.name ?? "—"} · {ticket.user?.email}
              {ticket.organization?.name ? ` · ${ticket.organization.name}` : ""}
            </p>
          )}
        </div>
        <Badge variant={sb.variant}>{sb.label}</Badge>
      </div>

      {/* Admin controls */}
      {/* Messages */}
      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.fromAdmin ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                m.fromAdmin
                  ? "bg-muted text-foreground"
                  : "bg-amber-500 text-white"
              }`}
            >
              <p className="mb-1 text-xs opacity-70">
                {m.fromAdmin ? "Support" : "You"} ·{" "}
                {new Date(m.createdAt).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.attachments.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                        m.fromAdmin
                          ? "border border-border hover:bg-background/50"
                          : "bg-white/20 hover:bg-white/30"
                      }`}
                    >
                      <PaperclipIcon className="size-3" />
                      Attachment {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      {isClosed ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
            This ticket is closed.
          </div>
          {admin && <div className="flex justify-start">{statusDropdown}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            rows={4}
            placeholder="Write a reply…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {admin ? (
                statusDropdown
              ) : (
                <Button
                  variant="outline"
                  onClick={() => close.mutate({ id: ticketId })}
                  disabled={close.isPending}
                >
                  Close ticket
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <PaperclipIcon className="size-4" />
                Attach Files
              </Button>
              <Button
                onClick={handleReply}
                disabled={!body || uploading || reply.isPending}
              >
                {uploading || reply.isPending ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
