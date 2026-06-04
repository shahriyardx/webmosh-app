"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Residential address is required"),
})

type Schema = z.infer<typeof schema>

interface StepDirectorProps {
  onNext: (data: { director: Schema }) => void
  initialValues?: Schema
}

const fields = [
  {
    name: "firstName" as const,
    label: "First Name",
    type: "text",
    placeholder: "John",
  },
  {
    name: "lastName" as const,
    label: "Last Name",
    type: "text",
    placeholder: "Doe",
  },
  {
    name: "email" as const,
    label: "Email",
    type: "email",
    placeholder: "john@example.com",
  },
  {
    name: "phone" as const,
    label: "Phone Number",
    type: "tel",
    placeholder: "+44 7700 900000",
  },
  {
    name: "dateOfBirth" as const,
    label: "Date of Birth",
    type: "date",
    placeholder: "",
  },
  {
    name: "address" as const,
    label: "Residential Address",
    type: "text",
    placeholder: "123 Main Street, London",
  },
] as const

export function StepDirector({ onNext, initialValues }: StepDirectorProps) {
  const { control, handleSubmit } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: initialValues || {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      address: "",
    },
  })

  const onSubmit = (data: Schema) => {
    onNext({ director: data })
  }

  return (
    <form
      id="step-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold">Add Director</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Provide details for the company director.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <div
                className={
                  field.name === "address" || field.name === "email"
                    ? "sm:col-span-2"
                    : ""
                }
              >
                <Field data-invalid={!!fieldState.error}>
                  <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={controllerField.value as string}
                    onChange={controllerField.onChange}
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <FieldError
                      errors={[{ message: fieldState.error.message }]}
                    />
                  )}
                </Field>
              </div>
            )}
          />
        ))}
      </div>
    </form>
  )
}
