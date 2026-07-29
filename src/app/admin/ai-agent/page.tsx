"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  SparklesIcon,
  SendIcon,
  WrenchIcon,
  CheckIcon,
  XIcon,
  Loader2Icon,
  AlertTriangleIcon,
  PaperclipIcon,
  FileTextIcon,
  ScanTextIcon,
  ChevronRightIcon,
  ListIcon,
  ClockIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react"

type ToolCall = { name: string; args: unknown; result: unknown }
type Pending = { name: string; args: Record<string, unknown>; summary: string }
type ExtractedData = {
  kind: string
  fields: Record<string, unknown>
  summary?: string
}
type MsgAttachment = { name: string; kind: "image" | "pdf"; previewUrl: string }
type ChatItem = {
  id: string
  role: "user" | "assistant"
  content: string
  attachments?: MsgAttachment[]
  toolCalls?: ToolCall[]
  pending?: Pending | null
  extractedData?: ExtractedData | null
  pendingHandled?: boolean
}

type Attachment = {
  id: string
  name: string
  kind: "image" | "pdf"
  mediaType: string
  data: string // base64 (no data: prefix)
  previewUrl: string // full data URL, for rendering
}

const rid = () => Math.random().toString(36).slice(2)

const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_FILES = 4

const SUGGESTIONS: { text: string; icon: typeof SparklesIcon }[] = [
  { text: "Show me all services", icon: ListIcon },
  { text: "Show me pending orders", icon: ClockIcon },
  { text: "Add a new service called Bookkeeping at $49", icon: PlusIcon },
]

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })

// ---------------------------------------------------------------------------
// Result formatting: render list-type tool results as a dashboard-style table,
// and keep the raw JSON tucked inside a collapsible metadata chip.
// ---------------------------------------------------------------------------

// Per-status colour, matching the admin orders page.
const STATUS_PILL: Record<string, string> = {
  pending:
    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  processing:
    "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  completed:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  awaiting_quote:
    "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) =>
      ["id", "rdp", "url"].includes(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ")
}

function formatCell(key: string, v: unknown) {
  if (v === null || v === undefined || v === "") {
    return <span className="text-muted-foreground">—</span>
  }
  const lk = key.toLowerCase()
  if (lk === "status" && typeof v === "string") {
    return (
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize ${
          STATUS_PILL[v] ?? "border-border bg-muted text-muted-foreground"
        }`}
      >
        {v.replace(/_/g, " ")}
      </span>
    )
  }
  if ((lk.includes("price") || lk.includes("amount")) && typeof v === "number") {
    return <span className="tabular-nums">${v}</span>
  }
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (lk === "id" && typeof v === "string") {
    return (
      <code className="font-mono text-[11px] text-muted-foreground">{v}</code>
    )
  }
  if (typeof v === "object") {
    return <code className="font-mono text-[11px]">{JSON.stringify(v)}</code>
  }
  return String(v)
}

/** An array of plain objects → table rows, else null (not list-shaped). */
function asRows(result: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(result)) return null
  if (result.length === 0) return []
  if (
    !result.every(
      (r) => r && typeof r === "object" && !Array.isArray(r),
    )
  ) {
    return null
  }
  return result as Record<string, unknown>[]
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        No results.
      </p>
    )
  }
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            {cols.map((c) => (
              <TableHead
                key={c}
                className="h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide"
              >
                {humanize(c)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell
                  key={c}
                  className="whitespace-nowrap py-2 text-xs"
                >
                  {formatCell(c, r[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** One tool call: a formatted table for list results, plus a collapsed,
 *  metadata-styled chip that expands the raw JSON for debugging. */
function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)
  const rows = asRows(tc.result)
  return (
    <div className="space-y-1.5">
      {rows && <ResultTable rows={rows} />}
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <WrenchIcon className="size-3" />
          {tc.name}
          <ChevronRightIcon
            className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        {open && (
          <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-2.5 font-mono text-[11px] text-muted-foreground">
            {JSON.stringify(tc.result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function AgentAvatar() {
  return (
    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 ring-1 ring-inset ring-sky-500/20">
      <SparklesIcon className="size-4" />
    </div>
  )
}

export default function AiAgentPage() {
  const { data: keyStatus } = trpc.aiAgent.keyStatus.useQuery()
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const chat = trpc.aiAgent.chat.useMutation()
  const confirm = trpc.aiAgent.confirm.useMutation()
  const busy = chat.isPending || confirm.isPending

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [items, busy])

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const next: Attachment[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`Unsupported file: ${file.name}`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is too large (max 5MB).`)
        continue
      }
      const dataUrl = await readAsDataUrl(file)
      const base64 = dataUrl.split(",")[1] ?? ""
      next.push({
        id: rid(),
        name: file.name,
        kind: file.type === "application/pdf" ? "pdf" : "image",
        mediaType: file.type,
        data: base64,
        previewUrl: dataUrl,
      })
    }
    setAttachments((prev) => {
      const merged = [...prev, ...next]
      if (merged.length > MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files.`)
      }
      return merged.slice(0, MAX_FILES)
    })
  }

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))

  const send = async (text: string) => {
    const content = text.trim()
    if ((!content && attachments.length === 0) || busy) return
    const atts = attachments
    const userItem: ChatItem = {
      id: rid(),
      role: "user",
      content: content || "(document attached)",
      attachments: atts.map((a) => ({
        name: a.name,
        kind: a.kind,
        previewUrl: a.previewUrl,
      })),
    }
    const nextItems = [...items, userItem]
    setItems(nextItems)
    setInput("")
    setAttachments([])

    const history = nextItems.map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = await chat.mutateAsync({
        messages: history,
        attachments: atts.length
          ? atts.map((a) => ({
              kind: a.kind,
              mediaType: a.mediaType,
              data: a.data,
            }))
          : undefined,
      })
      setItems((prev) => [
        ...prev,
        {
          id: rid(),
          role: "assistant",
          content: res.reply,
          toolCalls: res.toolCalls,
          pending: res.pendingConfirmation,
          extractedData: res.extractedData,
        },
      ])
    } catch (e) {
      setItems((prev) => [
        ...prev,
        {
          id: rid(),
          role: "assistant",
          content:
            e instanceof Error ? `⚠️ ${e.message}` : "⚠️ Something went wrong.",
        },
      ])
    }
  }

  const runConfirm = async (itemId: string, pending: Pending) => {
    try {
      const res = await confirm.mutateAsync({
        name: pending.name,
        args: pending.args,
      })
      setItems((prev) =>
        prev
          .map((it) =>
            it.id === itemId ? { ...it, pendingHandled: true } : it,
          )
          .concat({
            id: rid(),
            role: "assistant",
            content: res.reply,
            toolCalls: [res.toolCall],
          }),
      )
    } catch (e) {
      setItems((prev) =>
        prev
          .map((it) =>
            it.id === itemId ? { ...it, pendingHandled: true } : it,
          )
          .concat({
            id: rid(),
            role: "assistant",
            content:
              e instanceof Error ? `⚠️ ${e.message}` : "⚠️ Action failed.",
          }),
      )
    }
  }

  const cancelConfirm = (itemId: string) => {
    setItems((prev) =>
      prev
        .map((it) => (it.id === itemId ? { ...it, pendingHandled: true } : it))
        .concat({
          id: rid(),
          role: "assistant",
          content: "Cancelled — nothing was changed.",
        }),
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-3xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-sky-500/25 ring-1 ring-inset ring-white/20">
          <SparklesIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            AI Agent
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage the platform with natural language, or attach a document to
            extract. Actions run only after you confirm.
          </p>
        </div>
      </div>

      {keyStatus && !keyStatus.configured && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
          <AlertTriangleIcon className="size-4 shrink-0 text-amber-500" />
          <span>No Anthropic API key configured.</span>
          <Link
            href="/admin/settings"
            className="font-medium text-sky-500 hover:underline"
          >
            Set one in Settings →
          </Link>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative flex-1 space-y-6 overflow-y-auto rounded-2xl border border-border/70 bg-gradient-to-b from-muted/30 via-muted/15 to-transparent p-4 shadow-sm sm:p-5"
      >
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-sky-500/25 blur-2xl" />
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30 ring-1 ring-inset ring-white/20">
                <SparklesIcon className="size-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">
                How can I help?
              </h2>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Manage services, orders, invoices and more — or attach an
                invoice, ID, or payment screenshot to extract its data.
              </p>
            </div>
            <div className="grid w-full max-w-md gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => send(s.text)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card/70 px-3.5 py-2.5 text-left text-sm backdrop-blur-sm transition-all hover:border-sky-500/40 hover:bg-card hover:shadow-sm"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 transition-colors group-hover:bg-sky-500/15">
                    <s.icon className="size-4" />
                  </span>
                  <span className="flex-1 text-foreground">{s.text}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-sky-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {items.map((it) =>
          it.role === "user" ? (
            <div key={it.id} className="flex justify-end">
              <div className="flex max-w-[85%] flex-col items-end gap-2">
                {/* Attachment thumbnails */}
                {it.attachments && it.attachments.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {it.attachments.map((att, i) =>
                      att.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={att.previewUrl}
                          alt={att.name}
                          className="size-20 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs"
                        >
                          <FileTextIcon className="size-4 text-sky-500" />
                          <span className="max-w-32 truncate">{att.name}</span>
                        </div>
                      ),
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-sky-500 px-4 py-2.5 text-sm text-white shadow-sm">
                  {it.content}
                </div>
              </div>
            </div>
          ) : (
            <div key={it.id} className="flex gap-3">
              <AgentAvatar />
              <div className="min-w-0 flex-1 space-y-2.5">
                {it.content && (
                  <div className="w-fit max-w-full whitespace-pre-wrap rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5 text-sm shadow-sm">
                    {it.content}
                  </div>
                )}

                {/* Formatted tool results + collapsible raw JSON */}
                {it.toolCalls?.map((tc, i) => (
                  <ToolCallBlock key={i} tc={tc} />
                ))}

                {/* Extracted-document review card */}
                {it.extractedData && !it.pendingHandled && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-3.5 py-3 text-xs">
                    <p className="flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400">
                      <ScanTextIcon className="size-3.5" />
                      Extracted {it.extractedData.kind.replace(/_/g, " ")}
                    </p>
                    {it.extractedData.summary && (
                      <p className="mt-1 text-foreground">
                        {it.extractedData.summary}
                      </p>
                    )}
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      {Object.entries(it.extractedData.fields).map(([k, v]) => (
                        <Fragment key={k}>
                          <dt className="capitalize text-muted-foreground">
                            {k.replace(/_/g, " ")}
                          </dt>
                          <dd className="break-all font-medium">
                            {v === null || v === undefined || v === ""
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Review the values above — correct them by asking me — then
                      confirm to save.
                    </p>
                  </div>
                )}

                {/* Pending confirmation */}
                {it.pending && !it.pendingHandled && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-xs">
                    <p className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangleIcon className="size-3.5" />
                      Confirm required
                    </p>
                    <p className="mt-1 text-foreground">{it.pending.summary}</p>
                    <div className="mt-2.5 flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => runConfirm(it.id, it.pending!)}
                      >
                        {confirm.isPending ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <CheckIcon className="size-3.5" />
                        )}
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => cancelConfirm(it.id)}
                      >
                        <XIcon className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex gap-3">
            <AgentAvatar />
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground shadow-sm">
              <Loader2Icon className="size-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Attachment previews (pending send) */}
      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
            >
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.previewUrl}
                  alt={a.name}
                  className="size-6 rounded object-cover"
                />
              ) : (
                <FileTextIcon className="size-4 text-sky-500" />
              )}
              <span className="max-w-28 truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove attachment"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="mt-3"
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <div className="flex items-end gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/15">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            disabled={busy || attachments.length >= MAX_FILES}
            onClick={() => fileRef.current?.click()}
            title="Attach image or PDF"
          >
            <PaperclipIcon className="size-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask the agent, or attach a document to extract…"
            className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={busy}
          />
          <Button
            type="submit"
            size="icon"
            className="size-9 shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm transition-opacity hover:from-sky-500 hover:to-blue-700 disabled:opacity-40"
            disabled={busy || (!input.trim() && attachments.length === 0)}
          >
            {busy ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-center text-[11px] text-muted-foreground/70">
          Press Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </div>
  )
}
