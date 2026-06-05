"use client"

import { Controller, UseFormReturn } from "react-hook-form"
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

export const packageFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  country: z.enum(["us", "uk"]),
  features: z.string().min(1, "At least one feature required"),
  price: z.string().min(1, "Price is required"),
})

export type PackageForm = z.infer<typeof packageFormSchema>

export const packageFormDefaults: PackageForm = {
  title: "",
  country: "us",
  features: "",
  price: "",
}

export function PackageFormFields({
  form,
}: {
  form: UseFormReturn<PackageForm>
}) {
  return (
    <>
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
    </>
  )
}

export function PackageFormActions({
  loading,
  onCancel,
}: {
  loading: boolean
  onCancel?: () => void
}) {
  return (
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
  )
}
