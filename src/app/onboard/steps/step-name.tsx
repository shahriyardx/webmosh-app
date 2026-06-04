"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
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
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import {
  SearchIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"

const schema = z.object({
  companyName: z.string().min(1, "Company name is required"),
})

type Schema = z.infer<typeof schema>

interface StepNameProps {
  onNext: (data: { companyName: string }) => void
  country: string | undefined
  initialValue?: string
  onReady?: (v: boolean) => void
}

export function StepName({
  onNext,
  country,
  initialValue,
  onReady,
}: StepNameProps) {
  const [nameSuffix, setNameSuffix] = useState("LTD")
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)

  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: initialValue || "" },
  })

  const value = watch("companyName")
  const isUk = country === "uk"

  // US skips availability check
  useEffect(() => {
    if (!isUk) {
      setNameAvailable(true)
    }
  }, [isUk])

  const nameReady = !isUk || nameAvailable === true
  useEffect(() => {
    onReady?.(nameReady)
  }, [nameReady, onReady])

  const checkMutation = trpc.companies.checkName.useMutation({
    onSuccess: (data) => {
      setNameAvailable(data.available)
    },
    onError: () => {
      setNameAvailable(null)
    },
  })

  const handleCheck = () => {
    if (!value.trim()) return
    setNameAvailable(null)
    const fullName = `${value.trim()} ${nameSuffix}`
    checkMutation.mutate({ name: fullName, country: "uk" })
  }

  const onSubmit = (data: Schema) => {
    if (isUk && nameAvailable !== true) return
    const fullName = isUk
      ? `${data.companyName} ${nameSuffix}`
      : data.companyName
    onNext({ companyName: fullName })
  }

  const placeholder = isUk ? "e.g. Acme" : "e.g. Acme LLC"

  return (
    <form
      id="step-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold">Company Name</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isUk
            ? "Enter the name for your company. We'll check availability."
            : "Enter the name for your company."}
        </p>
      </div>

      <Field data-invalid={!!errors.companyName}>
        <FieldLabel htmlFor="companyName">Company Name</FieldLabel>
        <FieldDescription>
          {isUk
            ? "Must be unique in the UK."
            : "Availability confirmed at filing."}
        </FieldDescription>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              id="companyName"
              value={value}
              onChange={(e) => {
                setValue("companyName", e.target.value)
                if (isUk) setNameAvailable(null)
              }}
              placeholder={placeholder}
              aria-invalid={!!errors.companyName}
            />
          </div>
          {isUk && (
            <Select value={nameSuffix} onValueChange={setNameSuffix}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LTD">LTD</SelectItem>
                <SelectItem value="LIMITED">LIMITED</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isUk && (
            <Button
              variant="outline"
              type="button"
              onClick={handleCheck}
              disabled={!value.trim() || checkMutation.isPending}
            >
              {checkMutation.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SearchIcon className="size-4" />
              )}
              Check
            </Button>
          )}
        </div>
        {errors.companyName && (
          <FieldError errors={[{ message: errors.companyName.message }]} />
        )}
      </Field>

      {isUk && nameAvailable === true && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-600">
          <CheckCircle2Icon className="size-4 shrink-0" />
          Name is available!
        </div>
      )}
      {isUk && nameAvailable === false && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          <XCircleIcon className="size-4 shrink-0" />
          Name is not available. Try a different name.
        </div>
      )}
    </form>
  )
}
