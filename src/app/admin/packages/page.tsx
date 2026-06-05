"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  PackageIcon,
  DollarSignIcon,
  GlobeIcon,
} from "lucide-react"

const packageFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  country: z.enum(["us", "uk"]),
  features: z.string().min(1, "Enter at least one feature (comma-separated)"),
  price: z.string().min(1, "Price is required"),
})

type PackageForm = z.infer<typeof packageFormSchema>

const defaultValues: PackageForm = {
  title: "",
  country: "us",
  features: "",
  price: "",
}

export default function AdminPackagesPage() {
  const utils = trpc.useUtils()
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: packages, isLoading } = trpc.packages.list.useQuery()
  const updatePkg = trpc.packages.update.useMutation({
    onSuccess: () => { utils.packages.list.invalidate(); setEditingId(null) },
  })
  const deletePkg = trpc.packages.delete.useMutation({
    onSuccess: () => utils.packages.list.invalidate(),
  })

  const editForm = useForm<PackageForm>({
    resolver: zodResolver(packageFormSchema),
    defaultValues,
  })

  const handleUpdate = (data: PackageForm) => {
    if (!editingId) return
    updatePkg.mutate({
      id: editingId,
      title: data.title,
      country: data.country,
      features: data.features.split(",").map((f) => f.trim()).filter(Boolean),
      price: parseInt(data.price, 10),
    })
    editForm.reset(defaultValues)
  }

  const startEdit = (pkg: NonNullable<typeof packages>[number]) => {
    setEditingId(pkg.id)
    editForm.reset({
      title: pkg.title,
      country: pkg.country as "us" | "uk",
      features: pkg.features.join(", "),
      price: String(pkg.price),
    })
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this package?")) return
    deletePkg.mutate({ id })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Packages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage formation packages and pricing.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/packages/new">
            <PlusIcon className="mr-1.5 size-4" />
            New Package
          </Link>
        </Button>
      </div>

      {packages?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <PackageIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No packages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {packages?.map((pkg) => (
            editingId === pkg.id ? (
              <Card key={pkg.id}>
                <CardHeader>
                  <CardTitle className="text-base">Edit Package</CardTitle>
                </CardHeader>
                <CardContent>
                  <PackageFormContent
                    form={editForm}
                    onSubmit={handleUpdate}
                    loading={updatePkg.isPending}
                    onCancel={() => { setEditingId(null); editForm.reset(defaultValues) }}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card key={pkg.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                  <div className="flex items-start gap-3 pt-1">
                    <PackageIcon className="size-5 shrink-0 text-amber-500" />
                    <div>
                      <CardTitle className="text-base">{pkg.title}</CardTitle>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <GlobeIcon className="size-3" />
                        {pkg.country === "uk" ? "United Kingdom" : "United States"}
                        <span className="text-muted-foreground/30">|</span>
                        <DollarSignIcon className="size-3" />
                        {(pkg.price / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => startEdit(pkg)}>
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => handleDelete(pkg.id)}>
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.features.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  )
}

function PackageFormContent({
  form,
  onSubmit,
  loading,
  onCancel,
}: {
  form: ReturnType<typeof useForm<PackageForm>>
  onSubmit: (data: PackageForm) => void
  loading: boolean
  onCancel?: () => void
}) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Title</FieldLabel>
            <FieldContent>
              <Input placeholder="e.g. Starter LLC" {...field} />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="country"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Country</FieldLabel>
            <FieldContent>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="features"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Features (comma-separated)</FieldLabel>
            <FieldContent>
              <Input placeholder="e.g. Free registered agent, Banking support" {...field} />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="price"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Price (cents)</FieldLabel>
            <FieldContent>
              <Input type="number" min={0} placeholder="e.g. 9900 for $99" {...field} />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  )
}
