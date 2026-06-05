"use client"

import { useRouter } from "next/navigation"
import { useFieldArray, useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { ArrowLeftIcon, PlusIcon, XIcon, SaveIcon } from "lucide-react"
import Link from "next/link"

const createPackageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  country: z.enum(["us", "uk"]),
  features: z
    .array(z.object({ value: z.string().min(1, "Feature cannot be empty") }))
    .min(1, "At least one feature required"),
  price: z.string().min(1, "Price is required"),
})

type CreatePackageForm = z.infer<typeof createPackageSchema>

export default function NewPackagePage() {
  const router = useRouter()
  const utils = trpc.useUtils()

  const createPkg = trpc.packages.create.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate()
      router.push("/admin/packages")
    },
  })

  const form = useForm<CreatePackageForm>({
    resolver: zodResolver(createPackageSchema),
    defaultValues: {
      title: "",
      country: "us",
      features: [{ value: "" }],
      price: "",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "features",
  })

  const onSubmit = (data: CreatePackageForm) => {
    createPkg.mutate({
      title: data.title,
      country: data.country,
      features: data.features.map((f) => f.value),
      price: parseInt(data.price, 10),
    })
  }

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="size-8">
          <Link href="/admin/packages">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            New Package
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new formation package.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Package Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 text-red-500"
                              onClick={() => remove(index)}
                            >
                              <XIcon className="size-4" />
                            </Button>
                          )}
                          <FieldError errors={[fieldState.error]} />
                        </div>
                      )}
                    />
                  ))}
                </div>
                <FieldError
                  errors={[form.formState.errors.features]}
                />
              </FieldContent>
            </Field>

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
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createPkg.isPending}>
                <SaveIcon className="mr-1.5 size-4" />
                {createPkg.isPending ? "Creating…" : "Create Package"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
