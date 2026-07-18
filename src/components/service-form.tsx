"use client"

import Link from "next/link"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
import { PlusIcon, XIcon, PaletteIcon } from "lucide-react"

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  features: z
    .array(z.object({ value: z.string().min(1, "Feature cannot be empty") }))
    .min(1, "At least one feature required"),
  price: z.string().min(1, "Price is required"),
  country: z.enum(["us", "uk"]),
  type: z.enum(["general", "wordpress"]),
})

type Schema = z.infer<typeof schema>

const defaultValues: Schema = {
  title: "",
  description: "",
  features: [{ value: "" }],
  price: "",
  country: "us",
  type: "general",
}

function parseForm(data: Schema) {
  return {
    title: data.title,
    description: data.description,
    features: data.features.map((f) => f.value),
    price: parseFloat(data.price),
    country: data.type === "wordpress" ? null : data.country,
    type: data.type,
  }
}

export function ServiceForm({
  defaultValues: initial = defaultValues,
  onSubmit,
  loading,
  submitLabel = "Save",
  onCancel,
}: {
  defaultValues?: Schema
  onSubmit: (data: ReturnType<typeof parseForm>) => void
  loading: boolean
  submitLabel?: string
  onCancel?: () => void
}) {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "features",
  })

  const serviceType = form.watch("type")
  const isWordpress = serviceType === "wordpress"

  return (
    <form
      onSubmit={form.handleSubmit((data) => onSubmit(parseForm(data)))}
      className="max-w-md space-y-5"
    >
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Title</FieldLabel>
            <FieldContent>
              <Input placeholder="e.g. Registered Agent" {...field} />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      {!isWordpress && (
        <Controller
          control={form.control}
          name="country"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Country</FieldLabel>
              <FieldContent>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="w-full">
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
      )}
      <Controller
        control={form.control}
        name="type"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Service type</FieldLabel>
            <FieldContent>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="wordpress">WordPress development</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                WordPress services will ask the customer for cPanel / WP-admin
                access and a theme (demo or custom).
              </p>
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      {isWordpress && (
        <div className="rounded-lg border border-dashed border-sky-500/40 bg-sky-500/5 p-3">
          <div className="flex items-start gap-3">
            <PaletteIcon className="mt-0.5 size-4 shrink-0 text-sky-500" />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium">Demo themes are shared</p>
                <p className="text-xs text-muted-foreground">
                  WordPress services are available to all customers regardless
                  of country. Demo themes are managed centrally — every
                  WordPress service offers the same catalog.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <Link href="/admin/wordpress-demo">Manage demo themes</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Description</FieldLabel>
            <FieldContent>
              <Textarea
                placeholder="Describe the service…"
                className="min-h-24"
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </FieldContent>
          </Field>
        )}
      />
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel>Features</FieldLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ value: "" })}
          >
            <PlusIcon className="mr-1 size-3" />
            Add feature
          </Button>
        </div>
        <FieldContent>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <Controller
                key={field.id}
                control={form.control}
                name={`features.${index}.value`}
                render={({ field, fieldState }) => (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Feature ${index + 1}`}
                      {...field}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 shrink-0 text-red-500"
                        onClick={() => remove(index)}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    )}
                    <div className="hidden">
                      <FieldError errors={[fieldState.error]} />
                    </div>
                  </div>
                )}
              />
            ))}
          </div>
          <FieldError errors={[form.formState.errors.features]} />
        </FieldContent>
      </Field>

      <Controller
        control={form.control}
        name="price"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Price (USD)</FieldLabel>
            <FieldContent>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 49.00"
                {...field}
              />
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
          {loading ? `${submitLabel}…` : submitLabel}
        </Button>
      </div>
    </form>
  )
}
