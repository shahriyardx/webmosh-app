"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { DiscussionChat } from "@/components/discussion-chat"
import { TaskDetailsPanel } from "@/components/task-details-panel"
import {
  MessagesSquareIcon,
  ChevronLeftIcon,
  SearchIcon,
  PanelRightOpenIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const STATUS_DOT: Record<string, string> = {
  todo: "bg-muted-foreground/40",
  in_progress: "bg-sky-500",
  blocked: "bg-red-500",
  done: "bg-emerald-500",
}

function initials(name?: string | null) {
  if (!name) return "?"
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"
}

function DiscussionsInner() {
  const router = useRouter()
  const params = useSearchParams()
  const activeTaskId = params.get("task")
  const [search, setSearch] = useState("")
  const [detailsOpen, setDetailsOpen] = useState(false)

  const { data: threads, isLoading } = trpc.discussions.allThreads.useQuery(
    undefined,
    { refetchInterval: 15_000, refetchOnWindowFocus: true },
  )

  const filtered = (threads ?? []).filter((t) => {
    const q = search.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      (t.assignedTo?.name ?? "").toLowerCase().includes(q)
    )
  })
  const active = threads?.find((t) => t.id === activeTaskId)

  const select = (taskId: string) => {
    router.replace(`/admin/discussions?task=${taskId}`)
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10">
          <MessagesSquareIcon className="size-5 text-sky-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Discussions
          </h1>
          <p className="text-sm text-muted-foreground">
            Task conversations with your freelancers.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
       <div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Thread list */}
        <div
          className={`flex w-full flex-col border-r border-border bg-muted/20 sm:w-80 sm:shrink-0 ${
            activeTaskId ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="border-b border-border p-3">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search task or freelancer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border-transparent bg-card pl-8"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <MessagesSquareIcon className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {threads?.length
                    ? "No conversations match your search."
                    : "No discussions yet. Freelancers can start one from any task."}
                </p>
              </div>
            ) : (
              filtered.map((t) => {
                const activeItem = t.id === activeTaskId
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select(t.id)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      activeItem
                        ? "bg-sky-500/10 ring-1 ring-inset ring-sky-500/20"
                        : "hover:bg-card"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="flex size-9 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-500">
                        {initials(t.assignedTo?.name)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card ${
                          STATUS_DOT[t.status] ?? STATUS_DOT.todo
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            activeItem ? "text-sky-600 dark:text-sky-400" : ""
                          }`}
                        >
                          {t.title}
                        </p>
                        {t.unread > 0 && (
                          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                            {t.unread}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {t.assignedTo?.name ?? "Freelancer"}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          t.unread > 0
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t.lastMessage
                          ? `${t.lastMessage.fromAdmin ? "You: " : ""}${t.lastMessage.body}`
                          : "No messages yet"}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Chat pane */}
        <div
          className={`min-w-0 flex-1 flex-col ${
            activeTaskId ? "flex" : "hidden sm:flex"
          }`}
        >
          {activeTaskId ? (
            <>
              <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
                <button
                  type="button"
                  onClick={() => router.replace("/admin/discussions")}
                  className="text-muted-foreground hover:text-foreground sm:hidden"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <div className="relative shrink-0">
                  <div className="flex size-9 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-500">
                    {initials(active?.assignedTo?.name)}
                  </div>
                  {active && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card ${
                        STATUS_DOT[active.status] ?? STATUS_DOT.todo
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {active?.title ?? "Task"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {active?.assignedTo?.name ?? "Freelancer"}
                    {active?.order?.service?.title
                      ? ` · ${active.order.service.title}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted xl:hidden"
                  title="Task details"
                >
                  <PanelRightOpenIcon className="size-4" />
                  Details
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <DiscussionChat taskId={activeTaskId} perspective="admin" />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
                <MessagesSquareIcon className="size-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Select a conversation
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Pick a task on the left to read and reply to the freelancer.
              </p>
            </div>
          )}
        </div>
       </div>

        {/* Task details — persistent side card on wide screens */}
        {activeTaskId && (
          <aside className="hidden w-80 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm xl:block">
            <TaskDetailsPanel taskId={activeTaskId} />
          </aside>
        )}
      </div>

      {/* Task details — sheet on smaller screens */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Task details</SheetTitle>
          </SheetHeader>
          {activeTaskId && <TaskDetailsPanel taskId={activeTaskId} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function AdminDiscussionsPage() {
  return (
    <Suspense fallback={null}>
      <DiscussionsInner />
    </Suspense>
  )
}
