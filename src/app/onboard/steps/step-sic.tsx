"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Field, FieldError } from "@/components/ui/field"
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select"
import { ukSicCodes, usSicCodes } from "@/sic-codes"

const schema = z.object({
  sicCode: z.string().min(1, "Select a SIC code"),
  sicDescription: z.string().optional(),
})

type Schema = z.infer<typeof schema>

interface StepSicProps {
  onNext: (data: { sicCode: string; sicDescription?: string }) => void
  country: string | undefined
  initialCode?: string
  initialDescription?: string
}

export function StepSic({
  onNext,
  country,
  initialCode,
  initialDescription,
}: StepSicProps) {
  const { control, handleSubmit, setValue } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      sicCode: initialCode || "",
      sicDescription: initialDescription || "",
    },
  })

  const codes = country === "us" ? usSicCodes : ukSicCodes

  return (
    <form id="step-form" onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Company SIC Code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the SIC code that best describes your business activity.
        </p>
      </div>

      <Controller
        name="sicCode"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <MultiSelect
              single
              values={field.value ? [field.value] : []}
              onValuesChange={(vals) => {
                const code = vals[0]
                const match = codes.find((s) => s.code === code)
                field.onChange(code)
                setValue("sicDescription", match?.description ?? "")
              }}
            >
              <MultiSelectTrigger id="sic-code" className="w-full">
                <MultiSelectValue placeholder="Search SIC codes..." />
              </MultiSelectTrigger>
              <MultiSelectContent
                search={{
                  placeholder: "Search by code or description...",
                  emptyMessage: "No SIC code found.",
                }}
              >
                {codes.map((sic) => (
                  <MultiSelectItem
                    key={sic.code}
                    value={sic.code}
                    badgeLabel={`${sic.code} — ${sic.description}`}
                  >
                    <span className="font-mono text-xs w-16 shrink-0">
                      {sic.code}
                    </span>
                    <span className="truncate">{sic.description}</span>
                  </MultiSelectItem>
                ))}
              </MultiSelectContent>
            </MultiSelect>
            {fieldState.error && (
              <FieldError errors={[{ message: fieldState.error.message }]} />
            )}
          </Field>
        )}
      />
    </form>
  )
}
