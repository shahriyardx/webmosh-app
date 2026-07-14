"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { MailIcon, DownloadIcon } from "lucide-react"
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

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All mail across your companies.
        </p>
      </div>

      {!mails || mails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <MailIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No mail yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Attachments</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mails.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => handleOpen(m)}
                >
                  <TableCell className={m.read ? "" : "font-semibold"}>
                    <span className="flex items-center gap-2">
                      {!m.read && <span className="size-2 shrink-0 rounded-full bg-sky-500" />}
                      {m.subject}
                    </span>
                  </TableCell>
                  <TableCell className="uppercase text-muted-foreground">
                    {m.organization?.name ?? "—"}
                  </TableCell>
                  <TableCell className={m.read ? "text-muted-foreground" : "font-medium"}>{m.from}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.attachments.length || "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
