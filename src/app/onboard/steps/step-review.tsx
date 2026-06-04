"use client"

import type { FormValues } from "../page"

interface StepReviewProps {
  data: FormValues
}

export function StepReview({ data }: StepReviewProps) {
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

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
        <p className="text-sm text-muted-foreground">
          By placing this order, you agree to our{" "}
          <span className="underline underline-offset-2">Terms of Service</span>{" "}
          and authorize us to file the company formation on your behalf.
        </p>
      </div>
    </div>
  )
}
