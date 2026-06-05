"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { CheckIcon } from "lucide-react"

interface StepServicesProps {
  country: "us" | "uk" | undefined
  onNext: (data: { serviceIds: string[] }) => void
  initialValue?: string[]
}

export function StepServices({ country, onNext, initialValue }: StepServicesProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialValue ?? [])

  const { data: services, isLoading } = trpc.services.list.useQuery()

  const filtered = (services ?? []).filter((s) => s.country === country)

  const toggleService = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext({ serviceIds: selectedIds })
  }

  if (!country) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Additional Services</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please select a country first.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  return (
    <form id="step-form" onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Additional Services</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select optional services for{" "}
          {country === "uk" ? "United Kingdom" : "United States"}.
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No additional services available for{" "}
          {country === "uk" ? "United Kingdom" : "United States"} yet. You can skip
          this step.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((svc) => {
            const isSelected = selectedIds.includes(svc.id)
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggleService(svc.id)}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                    : "border-border bg-background hover:border-amber-500/50"
                }`}
              >
                {isSelected && (
                  <div className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-white">
                    <CheckIcon className="size-3" />
                  </div>
                )}

                <h3 className="font-medium text-foreground">{svc.title}</h3>

                {svc.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {svc.description}
                  </p>
                )}

                <div className="mt-2 text-sm font-semibold text-foreground">
                  ${svc.price}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Skip & continue
        </button>
      </div>
    </form>
  )
}
