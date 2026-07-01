"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { uploadFiles } from "@/lib/upload"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LifeBuoyIcon, PlusIcon, PaperclipIcon } from "lucide-react"

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  open: { label: "Open", variant: "default" },
  pending: { label: "Awaiting reply", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
}

export default function TicketsPage() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: tickets, isLoading } = trpc.tickets.list.useQuery()

  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const create = trpc.tickets.create.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate()
      utils.tickets.openCount.invalidate()
      setOpen(false)
      setSubject("")
      setBody("")
      setFiles([])
      toast.success("Ticket created")
    },
  })

  const handleCreate = async () => {
    setUploading(true)
    try {
      const attachments = await uploadFiles(files, "ticket")
      await create.mutateAsync({ subject, body, attachments })
    } catch {
      toast.error("Failed to create ticket")
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a ticket and our team will help you out.
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
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <PaperclipIcon className="size-3" />
                  {files.length > 0 ? `${files.length} file(s) selected` : "Attach Files"}
                </Button>
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

      {!tickets || tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <LifeBuoyIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => {
                const sb = statusBadge[t.status] ?? statusBadge.open
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                  >
                    <TableCell className="font-medium">{t.subject}</TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
