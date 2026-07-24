"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { CheckIcon, PaletteIcon, Settings2Icon } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  WordpressCheckoutDialog,
  type WordpressPurchasePayload,
} from "@/components/wordpress-checkout-dialog"

type WordpressOrder = {
  serviceId: string
  wordpress: WordpressPurchasePayload["wordpress"]
}

interface StepServicesProps {
  country: "us" | "uk" | undefined
  companyName?: string
  onNext: (data: {
    serviceIds: string[]
    wordpressOrders: WordpressOrder[]
  }) => void
  initialValue?: string[]
  initialWordpress?: WordpressOrder[]
}

export function StepServices({
  country,
  companyName,
  onNext,
  initialValue,
  initialWordpress,
}: StepServicesProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialValue ?? [])
  const [wpOrders, setWpOrders] = useState<Record<string, WordpressOrder>>(
    Object.fromEntries((initialWordpress ?? []).map((o) => [o.serviceId, o])),
  )
  const [wpTarget, setWpTarget] = useState<{
    id: string
    title: string
    price: number
  } | null>(null)

  const { data: services, isLoading } = trpc.services.list.useQuery()

  const filtered = (services ?? []).filter(
    (s) => s.type === "wordpress" || s.country === country,
  )
  const wpServices = filtered.filter((s) => s.type === "wordpress")
  const generalServices = filtered.filter((s) => s.type !== "wordpress")

  const toggleService = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext({ serviceIds: selectedIds, wordpressOrders: Object.values(wpOrders) })
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
    <form id="step-form" onSubmit={handleSubmit} className="space-y-8">
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
        <div className="space-y-8">
          {wpServices.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Web development
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Configure your requirements now — each website is placed as its
                  own separate order.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {wpServices.map((svc) => {
                  const configured = !!wpOrders[svc.id]
                  return (
                    <Card
                      key={svc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setWpTarget({
                          id: svc.id,
                          title: svc.title,
                          price: svc.price,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setWpTarget({
                            id: svc.id,
                            title: svc.title,
                            price: svc.price,
                          })
                        }
                      }}
                      className={`relative flex cursor-pointer flex-col transition-all ${
                        configured
                          ? "ring-2 ring-sky-500"
                          : "hover:ring-foreground/20"
                      }`}
                    >
                      {configured && (
                        <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-sky-500 text-white">
                          <CheckIcon className="size-3" />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-500">
                            WordPress
                          </span>
                          {svc.title}
                        </CardTitle>
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
                              <li
                                key={i}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                              >
                                <CheckIcon className="size-3 shrink-0 text-green-600" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      )}

                      <CardFooter className="mt-auto justify-between">
                        <span className="text-sm font-semibold text-foreground">
                          From ${svc.price}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-500">
                          {configured ? (
                            <>
                              <Settings2Icon className="size-3" />
                              Edit details
                            </>
                          ) : (
                            <>
                              <PaletteIcon className="size-3" />
                              Configure →
                            </>
                          )}
                        </span>
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {generalServices.length > 0 && (
            <div className="space-y-3">
              {wpServices.length > 0 && (
                <h3 className="text-sm font-medium text-foreground">
                  Other services
                </h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {generalServices.map((svc) => {
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
                              <li
                                key={i}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                              >
                                <CheckIcon className="size-3 shrink-0 text-green-600" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      )}

                      <CardFooter className="mt-auto">
                        <span className="text-sm font-semibold text-foreground">
                          ${svc.price}
                        </span>
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Skip &amp; continue
        </button>
      </div>

      {wpTarget && (
        <WordpressCheckoutDialog
          open={!!wpTarget}
          onOpenChange={(open) => !open && setWpTarget(null)}
          serviceTitle={wpTarget.title}
          servicePrice={wpTarget.price}
          loading={false}
          defaultCompanyName={companyName}
          confirmLabel="Save details"
          onSubmit={(payload: WordpressPurchasePayload) => {
            setWpOrders((prev) => ({
              ...prev,
              [wpTarget.id]: {
                serviceId: wpTarget.id,
                wordpress: payload.wordpress,
              },
            }))
            setWpTarget(null)
          }}
        />
      )}
    </form>
  )
}
