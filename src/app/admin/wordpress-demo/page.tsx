"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { uploadFiles } from "@/lib/upload"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  PaletteIcon,
  ExternalLinkIcon,
  UploadIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react"

type ThemeRow = {
  id: string
  title: string
  description: string
  image: string | null
  demoUrl: string | null
}

type FormState = {
  title: string
  description: string
  image: string
  demoUrl: string
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  image: "",
  demoUrl: "",
}

export default function AdminThemesPage() {
  const utils = trpc.useUtils()
  const { data: themes, isLoading } = trpc.themes.list.useQuery()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ThemeRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ThemeRow | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (theme: ThemeRow) => {
    setEditing(theme)
    setForm({
      title: theme.title,
      description: theme.description,
      image: theme.image ?? "",
      demoUrl: theme.demoUrl ?? "",
    })
    setDialogOpen(true)
  }

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setUploading(true)
    try {
      const urls = await uploadFiles([file], "theme")
      const url = urls[0]
      if (!url) throw new Error("Upload returned no URL")
      setForm((prev) => ({ ...prev, image: url }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const createTheme = trpc.themes.create.useMutation({
    onSuccess: () => {
      utils.themes.list.invalidate()
      setDialogOpen(false)
      toast.success("Theme added")
    },
    onError: (err) => toast.error(err.message),
  })

  const updateTheme = trpc.themes.update.useMutation({
    onSuccess: () => {
      utils.themes.list.invalidate()
      setDialogOpen(false)
      toast.success("Theme updated")
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteTheme = trpc.themes.delete.useMutation({
    onSuccess: () => {
      utils.themes.list.invalidate()
      setDeleteTarget(null)
      toast.success("Theme deleted")
    },
    onError: (err) => toast.error(err.message),
  })

  const submit = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required")
      return
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      image: form.image.trim(),
      demoUrl: form.demoUrl.trim(),
    }
    if (editing) {
      updateTheme.mutate({ id: editing.id, ...payload })
    } else {
      createTheme.mutate(payload)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            WordPress themes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-built website designs your customers can pick during checkout.
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="mr-1.5 size-4" />
          New theme
        </Button>
      </div>

      {!themes?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <PaletteIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No themes yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.image}
                    alt={t.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/40">
                    <PaletteIcon className="size-10" />
                  </div>
                )}
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {t.description}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {t.demoUrl ? (
                    <a
                      href={t.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
                    >
                      View demo
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No demo URL
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => openEdit(t)}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-red-500"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit theme" : "New theme"}</DialogTitle>
            <DialogDescription>
              Preview image and demo URL are shown to customers during checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldContent>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Modern Business"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Short description customers will see"
                  className="min-h-24"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Preview image</FieldLabel>
              <FieldContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFilePick}
                />
                {form.image ? (
                  <div className="flex items-start gap-3">
                    <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.image}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2Icon className="mr-1.5 size-3 animate-spin" />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <UploadIcon className="mr-1.5 size-3" />
                            Replace image
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-500"
                        onClick={() => setForm({ ...form, image: "" })}
                      >
                        <XIcon className="mr-1.5 size-3" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full justify-start"
                  >
                    {uploading ? (
                      <>
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <UploadIcon className="mr-2 size-4" />
                        Upload preview image
                      </>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  PNG or JPG, ideally 16:9. Shown to customers during checkout.
                </p>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Demo URL</FieldLabel>
              <FieldContent>
                <Input
                  value={form.demoUrl}
                  onChange={(e) =>
                    setForm({ ...form, demoUrl: e.target.value })
                  }
                  placeholder="https://…"
                />
              </FieldContent>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                createTheme.isPending || updateTheme.isPending || uploading
              }
            >
              {createTheme.isPending || updateTheme.isPending
                ? "Saving…"
                : editing
                ? "Save changes"
                : "Create theme"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete theme"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.title}"? This can't be undone.`
            : ""
        }
        onConfirm={() =>
          deleteTarget && deleteTheme.mutate({ id: deleteTarget.id })
        }
        loading={deleteTheme.isPending}
      />
    </div>
  )
}
