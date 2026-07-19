"use client"

import { useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { uploadFiles } from "@/lib/upload"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  SendIcon,
  PaperclipIcon,
  XIcon,
  FileIcon,
  MessagesSquareIcon,
  Loader2Icon,
} from "lucide-react"

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"
}

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url.split("?")[0])
}

function timeLabel(date: Date) {
  return new Date(date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function dayLabel(date: Date) {
  const d = new Date(date)
  const now = new Date()
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/**
 * The message list + composer for a single task discussion. `perspective`
 * decides which bubbles are "mine" (right-aligned, sky) versus the other
 * party's. Works for both the admin and the freelancer side.
 */
export function DiscussionChat({
  taskId,
  perspective,
}: {
  taskId: string
  perspective: "admin" | "freelancer"
}) {
  const utils = trpc.useUtils()
  const { data: thread, isLoading } = trpc.discussions.getThread.useQuery(
    { taskId },
    { refetchInterval: 12_000, refetchOnWindowFocus: true },
  )

  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const messages = thread?.messages
  const messageCount = messages?.length ?? 0

  const markRead = trpc.discussions.markRead.useMutation({
    onSuccess: () => {
      utils.discussions.unreadCount.invalidate()
      utils.discussions.myThreads.invalidate()
      utils.discussions.allThreads.invalidate()
    },
  })

  const send = trpc.discussions.send.useMutation({
    onSuccess: () => {
      setBody("")
      setFiles([])
      utils.discussions.getThread.invalidate({ taskId })
      utils.discussions.myThreads.invalidate()
      utils.discussions.allThreads.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  // Mark the thread read whenever it opens or new inbound messages arrive.
  useEffect(() => {
    if (taskId) markRead.mutate({ taskId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, messageCount])

  // Keep the view pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messageCount])

  const handleSend = async () => {
    if (!body.trim() && files.length === 0) return
    setSending(true)
    try {
      const attachments = files.length ? await uploadFiles(files, "discussion") : []
      await send.mutateAsync({
        taskId,
        body: body.trim() || "(sent an attachment)",
        attachments,
      })
    } catch {
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-1 overflow-y-auto bg-muted/20 px-4 py-6"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages?.length ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
              <MessagesSquareIcon className="size-7 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No messages yet
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {perspective === "freelancer"
                ? "Start the conversation with the admin about this task."
                : "Reply to start the conversation with the freelancer."}
            </p>
          </div>
        ) : (
          <>
            <p className="mx-auto mb-4 w-fit rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
              Beginning of the conversation
            </p>
            {messages.map((m, i) => {
              const mine =
                perspective === "admin" ? m.fromAdmin : !m.fromAdmin
              const prev = messages[i - 1]
              const showDay =
                !prev ||
                new Date(prev.createdAt).toDateString() !==
                  new Date(m.createdAt).toDateString()
              // Group consecutive messages by the same sender within 5 min.
              const grouped =
                !!prev &&
                !showDay &&
                prev.fromAdmin === m.fromAdmin &&
                new Date(m.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() <
                  5 * 60_000
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                        {dayLabel(m.createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div
                    className={`flex items-end gap-2 ${grouped ? "mt-1" : "mt-3"} ${
                      mine ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {grouped ? (
                      <div className="size-8 shrink-0" />
                    ) : (
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          m.fromAdmin
                            ? "bg-violet-500/15 text-violet-500"
                            : "bg-sky-500/15 text-sky-500"
                        }`}
                      >
                        {m.fromAdmin ? "AD" : initials(m.sender?.name)}
                      </div>
                    )}
                    <div
                      className={`flex max-w-[78%] flex-col gap-1 ${
                        mine ? "items-end" : "items-start"
                      }`}
                    >
                      {!grouped && (
                        <p className="px-1 text-[11px] font-medium text-muted-foreground">
                          {m.fromAdmin
                            ? "Admin"
                            : m.sender?.name ?? "Freelancer"}
                        </p>
                      )}
                      {m.body !== "(sent an attachment)" && (
                        <div
                          className={`group relative rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                            mine
                              ? "rounded-br-md bg-sky-500 text-white"
                              : "rounded-bl-md border border-border bg-card text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {m.body}
                          </p>
                          <span
                            className={`float-right ml-3 mt-1 translate-y-0.5 text-[10px] ${
                              mine ? "text-white/70" : "text-muted-foreground"
                            }`}
                          >
                            {timeLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      {m.attachments.length > 0 && (
                        <div
                          className={`flex flex-wrap gap-2 ${
                            mine ? "justify-end" : "justify-start"
                          }`}
                        >
                          {m.attachments.map((url, idx) =>
                            isImage(url) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={url}
                                  alt="attachment"
                                  className="max-h-44 rounded-xl border border-border object-cover"
                                />
                              </a>
                            ) : (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs hover:bg-muted"
                              >
                                <FileIcon className="size-3.5 text-sky-500" />
                                Attachment {idx + 1}
                              </a>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card p-3">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs"
              >
                <PaperclipIcon className="size-3 shrink-0 text-sky-500" />
                <span className="max-w-[10rem] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/30">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              setFiles((prev) => [...prev, ...picked].slice(0, 5))
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-xl"
            onClick={() => fileRef.current?.click()}
            title="Attach files"
          >
            <PaperclipIcon className="size-4" />
          </Button>
          <Textarea
            rows={1}
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="max-h-32 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0 rounded-xl"
            disabled={sending || (!body.trim() && files.length === 0)}
            onClick={handleSend}
          >
            {sending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
