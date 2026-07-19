"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { MailIcon, MailOpenIcon, DownloadIcon, PaperclipIcon } from "lucide-react"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"

type Mail = inferRouterOutputs<AppRouter>["mails"]["listForUser"][number]

function downloadFile(url: string, name: string) {
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    })
    .catch(() => {
      window.open(url, "_blank")
    })
}

export default function AccountMailPage() {
  const utils = trpc.useUtils()
  const { data: mails, isLoading } = trpc.mails.listForUser.useQuery()
  const [selected, setSelected] = useState<Mail | null>(null)

  const markRead = trpc.mails.markRead.useMutation({
    onSuccess: () => {
      utils.mails.listForUser.invalidate()
      utils.mails.unreadCountForUser.invalidate()
    },
  })

  const handleOpen = (m: Mail) => {
    setSelected(m)
    if (!m.read) markRead.mutate({ id: m.id })
  }

  const unreadCount = (mails ?? []).filter((m) => !m.read).length

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
            Mail
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            All mail across your companies.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-600 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
            <MailIcon className="size-3.5" />
            {unreadCount} unread
          </span>
        )}
      </div>

      {!mails || mails.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <MailIcon className="size-6 text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No mail yet.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            We&apos;ll notify you when you receive new messages.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border">
            {mails.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleOpen(m)}
                className={`group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 ${
                  m.read ? "" : "bg-sky-500/[0.04]"
                }`}
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    m.read
                      ? "border border-border bg-muted/40"
                      : "bg-sky-500/10"
                  }`}
                >
                  {m.read ? (
                    <MailOpenIcon className="size-4 text-muted-foreground" />
                  ) : (
                    <MailIcon className="size-4 text-sky-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!m.read && (
                      <span className="size-2 shrink-0 rounded-full bg-sky-500" />
                    )}
                    <p
                      className={`truncate text-sm transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400 ${
                        m.read ? "font-medium" : "font-semibold"
                      }`}
                    >
                      {m.subject}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="uppercase tracking-wide">
                      {m.organization?.name ?? "—"}
                    </span>{" "}
                    · {m.from}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {m.attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <PaperclipIcon className="size-3" />
                      {m.attachments.length}
                    </span>
                  )}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.subject}</SheetTitle>
                <SheetDescription>
                  {selected.organization?.name ? `${selected.organization.name} · ` : ""}
                  From: {selected.from} · {new Date(selected.createdAt).toLocaleDateString()}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {selected.body}
                </p>
                {selected.attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Attachments
                    </p>
                    <div className="space-y-2">
                      {selected.attachments.map((url, i) => (
                        <Button
                          key={url}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => downloadFile(url, `attachment-${i + 1}`)}
                        >
                          <DownloadIcon className="size-4" />
                          Attachment {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
