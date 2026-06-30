"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const schema = z.object({
  country: z.enum(["us", "uk"], { error: "Select a country" }),
})

type Schema = z.infer<typeof schema>

interface StepCountryProps {
  onNext: (data: { country: "us" | "uk" }) => void
  initialValue?: string
}

export function StepCountry({ onNext, initialValue }: StepCountryProps) {
  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { country: (initialValue as "us" | "uk") || undefined },
  })

  const value = watch("country")

  return (
    <form id="step-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose Company Country</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the country where you want to register your company.
        </p>
      </div>

      <Field data-invalid={!!errors.country}>
        <RadioGroup
          value={value || ""}
          onValueChange={(v) => setValue("country", v as "us" | "uk")}
          className="grid gap-4 sm:grid-cols-2"
        >
          {[
            {
              value: "us",
              label: "United States",
              desc: "LLC",
            },
            { value: "uk", label: "United Kingdom", desc: "Ltd, Limited" },
          ].map((item) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: Radix RadioGroupItem inside label
            <label
              key={item.value}
              className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-5 transition-colors hover:border-amber-500/50 has-[[data-state=checked]]:border-amber-500 has-[[data-state=checked]]:bg-amber-500/5 ${
                value === item.value
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value={item.value} id={item.value} />
                <div className="space-y-1">
                  <FieldLabel
                    className="text-base font-medium"
                    htmlFor={item.value}
                  >
                    {item.label}
                  </FieldLabel>
                  <FieldDescription>{item.desc}</FieldDescription>
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>
        {errors.country && (
          <FieldError errors={[{ message: errors.country.message }]} />
        )}
      </Field>
    </form>
  )
}
