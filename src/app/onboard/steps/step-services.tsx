"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { CheckIcon } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

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
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
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
              <Card
                key={svc.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleService(svc.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggleService(svc.id)
                  }
                }}
                className={`relative flex cursor-pointer flex-col transition-all ${
                  isSelected
                    ? "ring-2 ring-sky-500"
                    : "hover:ring-foreground/20"
                }`}
              >
                {isSelected && (
                  <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-sky-500 text-white">
                    <CheckIcon className="size-3" />
                  </div>
                )}

                <CardHeader>
                  <CardTitle>{svc.title}</CardTitle>
                  {svc.description && (
                    <CardDescription className="line-clamp-2">
                      {svc.description}
                    </CardDescription>
                  )}
                </CardHeader>

                {svc.features.length > 0 && (
                  <CardContent className="flex-1">
                    <ul className="space-y-1">
                      {svc.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckIcon className="size-3 shrink-0 text-green-600" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}

                <CardFooter className="mt-auto">
                  <span className="text-sm font-semibold text-foreground">${svc.price}</span>
                </CardFooter>
              </Card>
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
