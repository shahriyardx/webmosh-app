"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@/lib/trpc/routers"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MailIcon,
  PencilIcon,
  RotateCcwIcon,
  SendIcon,
  PlusIcon,
  SparklesIcon,
  BellIcon,
  UserIcon,
  BriefcaseIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"

type EmailRow = inferRouterOutputs<AppRouter>["emails"]["list"][number]

const audienceMeta: Record<
  string,
  { title: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  customer: {
    title: "Customer emails",
    description: "Sent to your clients when something happens on their account.",
    icon: UserIcon,
  },
  freelancer: {
    title: "Freelancer emails",
    description: "Sent to freelancers you invite or work with.",
    icon: BriefcaseIcon,
  },
  admin: {
    title: "Admin alerts",
    description: "Sent to the admin inbox when customers do something.",
    icon: BellIcon,
  },
}

interface DraftState {
  subject: string
  heading: string
  intro: string
  ctaLabel: string
  enabled: boolean
}

function draftFrom(row: EmailRow): DraftState {
  const t = row.custom ?? row.defaults
  return {
    subject: t.subject,
    heading: t.heading,
    intro: t.intro,
    ctaLabel: t.ctaLabel ?? row.defaults.ctaLabel ?? "",
    enabled: row.custom ? row.custom.enabled : true,
  }
}

export default function AdminEmailsPage() {
  const utils = trpc.useUtils()
  const { data: rows, isLoading } = trpc.emails.list.useQuery()

  const [editing, setEditing] = useState<EmailRow | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createEvent, setCreateEvent] = useState<string>("")

  const save = trpc.emails.save.useMutation({
    onSuccess: () => {
      utils.emails.list.invalidate()
      toast.success("Template saved")
      setEditing(null)
      setDraft(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const reset = trpc.emails.reset.useMutation({
    onSuccess: () => {
      utils.emails.list.invalidate()
      toast.success("Template reset to default")
      setEditing(null)
      setDraft(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const sendTest = trpc.emails.sendTest.useMutation({
    onSuccess: () => toast.success("Test email sent to your inbox"),
    onError: (e) => toast.error(e.message),
  })

  const setEnabled = trpc.emails.setEnabled.useMutation({
    onSuccess: (_data, variables) => {
      utils.emails.list.invalidate()
      toast.success(variables.enabled ? "Email resumed" : "Email paused")
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteTemplate = trpc.emails.reset.useMutation({
    onSuccess: () => {
      utils.emails.list.invalidate()
      toast.success("Template deleted — default copy restored")
    },
    onError: (e) => toast.error(e.message),
  })

  const grouped = useMemo(() => {
    const groups: Record<string, EmailRow[]> = { customer: [], freelancer: [], admin: [] }
    for (const row of rows ?? []) {
      ;(groups[row.audience] ??= []).push(row)
    }
    return groups
  }, [rows])

  const customizedCount = rows?.filter((r) => r.custom).length ?? 0
  const disabledCount = rows?.filter((r) => r.custom && !r.custom.enabled).length ?? 0

  const openEditor = (row: EmailRow) => {
    setEditing(row)
    setDraft(draftFrom(row))
  }

  const handleCreatePick = (event: string) => {
    setCreateEvent(event)
    const row = rows?.find((r) => r.event === event)
    if (row) {
      setCreateOpen(false)
      setCreateEvent("")
      openEditor(row)
    }
  }

  const submitSave = () => {
    if (!editing || !draft) return
    if (!draft.subject.trim() || !draft.heading.trim() || !draft.intro.trim()) {
      toast.error("Subject, heading and body are required.")
      return
    }
    save.mutate({
      event: editing.event,
      subject: draft.subject,
      heading: draft.heading,
      intro: draft.intro,
      ctaLabel: draft.ctaLabel.trim() || undefined,
      enabled: draft.enabled,
    })
  }

  const insertVariable = (name: string) => {
    setDraft((d) => (d ? { ...d, intro: `${d.intro}${d.intro.endsWith(" ") || !d.intro ? "" : " "}{{${name}}}` } : d))
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email templates</h1>
          <p className="text-sm text-muted-foreground">
            Every email the platform sends, grouped by who receives it. Edit the copy,
            disable an email, or reset it to the default.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          New template
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Email events</CardDescription>
            <CardTitle className="text-2xl">{rows?.length ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customized</CardDescription>
            <CardTitle className="text-2xl">{customizedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paused</CardDescription>
            <CardTitle className="text-2xl">{disabledCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Loading templates…
          </CardContent>
        </Card>
      )}

      {(["customer", "freelancer", "admin"] as const).map((audience) => {
        const meta = audienceMeta[audience]
        const list = grouped[audience]
        if (!list?.length) return null
        return (
          <Card key={audience}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <meta.icon className="size-4 text-muted-foreground" />
                {meta.title}
                <Badge variant="secondary" className="ml-1">
                  {list.length}
                </Badge>
              </CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden md:table-cell">Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row) => {
                    const current = row.custom ?? row.defaults
                    const disabled = row.custom ? !row.custom.enabled : false
                    return (
                      <TableRow key={row.event} className={disabled ? "opacity-60" : ""}>
                        <TableCell>
                          <p className="font-medium">{row.label}</p>
                          <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                            {row.description}
                          </p>
                          <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {row.event}
                          </code>
                        </TableCell>
                        <TableCell className="hidden max-w-sm md:table-cell">
                          <p className="truncate text-sm">{current.subject}</p>
                        </TableCell>
                        <TableCell>
                          {disabled ? (
                            <Badge variant="destructive">
                              <PauseIcon className="mr-1 size-3" />
                              Paused
                            </Badge>
                          ) : row.custom ? (
                            <Badge className="bg-sky-500/15 text-sky-600 hover:bg-sky-500/15 dark:text-sky-400">
                              <SparklesIcon className="mr-1 size-3" />
                              Customized
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Send test email to me"
                              disabled={sendTest.isPending}
                              onClick={() => sendTest.mutate({ event: row.event })}
                            >
                              <SendIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`size-8 ${disabled ? "text-emerald-500 hover:text-emerald-500" : "text-amber-500 hover:text-amber-500"}`}
                              title={disabled ? "Resume this email" : "Pause this email"}
                              disabled={setEnabled.isPending}
                              onClick={() =>
                                setEnabled.mutate({
                                  event: row.event,
                                  enabled: disabled,
                                })
                              }
                            >
                              {disabled ? (
                                <PlayIcon className="size-4" />
                              ) : (
                                <PauseIcon className="size-4" />
                              )}
                            </Button>
                            {row.custom && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                title="Delete custom template (revert to default copy)"
                                disabled={deleteTemplate.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Delete the custom template for "${row.label}"? The built-in default copy will be used again.`,
                                    )
                                  ) {
                                    deleteTemplate.mutate({ event: row.event })
                                  }
                                }}
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditor(row)}
                            >
                              <PencilIcon className="size-3.5" />
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}

      {/* New template: pick the event first */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New email template</DialogTitle>
            <DialogDescription>
              Pick the event this template is for. You&apos;ll start from the current
              copy and can change everything.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Event</Label>
            <Select value={createEvent} onValueChange={handleCreatePick}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an event…" />
              </SelectTrigger>
              <SelectContent>
                {(["customer", "freelancer", "admin"] as const).map((aud) =>
                  grouped[aud]?.length ? (
                    <div key={aud}>
                      <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {audienceMeta[aud].title}
                      </p>
                      {grouped[aud].map((row) => (
                        <SelectItem key={row.event} value={row.event}>
                          {row.label}
                          {row.custom ? " (customized)" : ""}
                        </SelectItem>
                      ))}
                    </div>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setDraft(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editing && draft && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MailIcon className="size-4 text-muted-foreground" />
                  {editing.label}
                </DialogTitle>
                <DialogDescription>{editing.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {editing.variables.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Available variables — click to insert into the body
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {editing.variables.map((variable) => (
                        <button
                          key={variable.name}
                          type="button"
                          onClick={() => insertVariable(variable.name)}
                          title={`${variable.description} (e.g. ${variable.sample})`}
                          className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs hover:border-sky-500/50 hover:text-sky-500"
                        >
                          {`{{${variable.name}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tpl-subject">Subject</Label>
                  <Input
                    id="tpl-subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpl-heading">Heading</Label>
                  <Input
                    id="tpl-heading"
                    value={draft.heading}
                    onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The bold title shown at the top of the email body.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpl-intro">Body</Label>
                  <Textarea
                    id="tpl-intro"
                    rows={5}
                    value={draft.intro}
                    onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tpl-cta">Button label</Label>
                  <Input
                    id="tpl-cta"
                    value={draft.ctaLabel}
                    onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
                    placeholder={editing.defaults.ctaLabel ?? "e.g. View Dashboard"}
                  />
                  <p className="text-xs text-muted-foreground">
                    The button link destination is set automatically for each event.
                  </p>
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-border p-3">
                  <Checkbox
                    checked={draft.enabled}
                    onCheckedChange={(c) =>
                      setDraft({ ...draft, enabled: c === true })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium">Send this email</span>
                    <span className="block text-xs text-muted-foreground">
                      Uncheck to stop sending this email entirely. You can re-enable it
                      any time.
                    </span>
                  </span>
                </label>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sendTest.isPending}
                    onClick={() =>
                      sendTest.mutate({
                        event: editing.event,
                        draft: {
                          subject: draft.subject,
                          heading: draft.heading,
                          intro: draft.intro,
                          ctaLabel: draft.ctaLabel.trim() || undefined,
                        },
                      })
                    }
                  >
                    <SendIcon className="size-3.5" />
                    {sendTest.isPending ? "Sending…" : "Send test"}
                  </Button>
                  {editing.custom && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={reset.isPending}
                      onClick={() => reset.mutate({ event: editing.event })}
                    >
                      <RotateCcwIcon className="size-3.5" />
                      Reset to default
                    </Button>
                  )}
                </div>
                <Button type="button" onClick={submitSave} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save template"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
