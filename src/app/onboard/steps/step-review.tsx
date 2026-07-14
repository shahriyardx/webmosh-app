"use client"

import type { FormValues } from "../page"
import { trpc } from "@/lib/trpc/client"

interface StepReviewProps {
  data: FormValues
}

export function StepReview({ data }: StepReviewProps) {
  const { data: allPackages } = trpc.packages.list.useQuery()
  const { data: allServices } = trpc.services.list.useQuery()

  const selectedPackage = (allPackages ?? []).find((p) => p.id === data.packageId)
  const selectedServices = (allServices ?? []).filter((s) =>
    data.serviceIds?.includes(s.id),
  )

  const packagePrice = selectedPackage?.price ?? 0
  const servicesTotal = selectedServices.reduce((sum, s) => sum + s.price, 0)
  const grandTotal = packagePrice + servicesTotal

  const sections = [
    {
      title: "Country",
      value:
        data.country === "uk"
          ? "United Kingdom"
          : data.country === "us"
            ? "United States"
            : "—",
    },
    {
      title: "Company Name",
      value: data.companyName || "—",
    },
    {
      title: "SIC Code",
      value: data.sicCode
        ? `${data.sicCode} — ${data.sicDescription || ""}`
        : "—",
    },
    {
      title: "Passport",
      value: data.passportUrl ? "Uploaded" : "—",
    },
    {
      title: "Bank Statement",
      value: data.bankStatementUrl ? "Uploaded" : "—",
    },
    {
      title: "Director",
      value: data.director?.firstName
        ? `${data.director.firstName} ${data.director.lastName}`
        : "—",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & Place Order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your company formation details before placing the order.
        </p>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border">
        {sections.map((s) => (
          <div
            key={s.title}
            className="flex items-center justify-between px-5 py-3.5"
          >
            <span className="text-sm text-muted-foreground">{s.title}</span>
            <span className="text-sm font-medium text-right max-w-[50%] truncate">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Package summary */}
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Formation Package</h3>
        </div>
        {selectedPackage ? (
          <div className="flex items-center justify-between px-5 py-3.5">
            <div>
              <span className="text-sm font-medium">{selectedPackage.title}</span>
              {selectedPackage.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedPackage.description}
                </p>
              )}
            </div>
            <span className="text-sm font-semibold">
              ${selectedPackage.price}
            </span>
          </div>
        ) : (
          <div className="px-5 py-3.5 text-sm text-muted-foreground">None selected</div>
        )}
      </div>

      {/* Services summary */}
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Additional Services</h3>
        </div>
        {selectedServices.length > 0 ? (
          selectedServices.map((svc) => (
            <div
              key={svc.id}
              className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-b-0"
            >
              <div>
                <span className="text-sm font-medium">{svc.title}</span>
                {svc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {svc.description}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold">${svc.price}</span>
            </div>
          ))
        ) : (
          <div className="px-5 py-3.5 text-sm text-muted-foreground">
            No additional services selected
          </div>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-5 py-4">
        <span className="text-base font-semibold">Total</span>
        <span className="text-xl font-bold">${grandTotal}</span>
      </div>

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-5 py-4">
        <p className="text-sm text-muted-foreground">
          By placing this order, you agree to our{" "}
          <span className="underline underline-offset-2">Terms of Service</span>{" "}
          and authorize us to file the company formation on your behalf.
        </p>
      </div>
    </div>
  )
}
