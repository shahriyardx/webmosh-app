"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { CheckIcon } from "lucide-react"

interface StepPackageProps {
  country: "us" | "uk" | undefined
  onNext: (data: { packageId: string }) => void
  initialValue?: string
}

export function StepPackage({ country, onNext, initialValue }: StepPackageProps) {
  const [selectedId, setSelectedId] = useState(initialValue ?? "")

  const { data: packages, isLoading } = trpc.packages.list.useQuery()

  const filtered = (packages ?? []).filter((p) => p.country === country)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    onNext({ packageId: selectedId })
  }

  if (!country) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Select Package</h2>
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

  if (filtered.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Select Package</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No packages available for{" "}
            {country === "uk" ? "United Kingdom" : "United States"} yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form id="step-form" onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Package</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a formation package for{" "}
          {country === "uk" ? "United Kingdom" : "United States"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((pkg) => {
          const isSelected = selectedId === pkg.id
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedId(pkg.id)}
              className={`relative rounded-xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                  : "border-border bg-background hover:border-amber-500/50"
              }`}
            >
              {isSelected && (
                <div className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-amber-500 text-white">
                  <CheckIcon className="size-3.5" />
                </div>
              )}

              <h3 className="font-semibold text-foreground">{pkg.title}</h3>

              {pkg.description && (
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                  {pkg.description}
                </p>
              )}

              {pkg.features.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {pkg.features.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 text-lg font-bold text-foreground">
                ${pkg.price}
              </div>
            </button>
          )
        })}
      </div>
    </form>
  )
}
