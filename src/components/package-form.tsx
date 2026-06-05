"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  country: z.enum(["us", "uk"]),
  features: z.string().min(1, "At least one feature required"),
  price: z.string().min(1, "Price is required"),
})

type Schema = z.infer<typeof schema>

const defaultValues: Schema = {
  title: "",
  country: "us",
  features: "",
  price: "",
}

function parseForm(data: Schema) {
  return {
    title: data.title,
    country: data.country,
    features: data.features.split(",").map((f) => f.trim()).filter(Boolean),
    price: parseInt(data.price, 10),
  }
}

export function PackageForm({
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

  return (
    <form
      onSubmit={form.handleSubmit((data) => onSubmit(parseForm(data)))}
      className="space-y-5"
    >
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
              <Input
                placeholder="e.g. Free registered agent, Banking support"
                {...field}
              />
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
              <Input
                type="number"
                min={0}
                placeholder="e.g. 9900 for $99"
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
