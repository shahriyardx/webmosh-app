"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TagIcon, XIcon, CheckIcon } from "lucide-react"

/**
 * Coupon entry for an unpaid invoice. Applying a coupon discounts the amount
 * due; the parent should invalidate its invoice queries via `onChanged`.
 */
export function InvoiceCoupon({
  invoiceId,
  couponCode,
  discountAmount,
  originalAmount,
  onChanged,
}: {
  invoiceId: string
  couponCode: string | null | undefined
  discountAmount: number | null | undefined
  originalAmount: number | null | undefined
  onChanged: () => void
}) {
  const [code, setCode] = useState("")

  const apply = trpc.coupons.apply.useMutation({
    onSuccess: (res) => {
      toast.success(`Coupon applied — you saved $${res.discount.toFixed(2)}`)
      setCode("")
      onChanged()
    },
    onError: (e) => toast.error(e.message),
  })

  const remove = trpc.coupons.remove.useMutation({
    onSuccess: () => {
      toast.success("Coupon removed")
      onChanged()
    },
    onError: (e) => toast.error(e.message),
  })

  const applied = !!couponCode

  if (applied) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <CheckIcon className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Coupon{" "}
                <span className="font-mono uppercase text-emerald-600 dark:text-emerald-400">
                  {couponCode}
                </span>{" "}
                applied
              </p>
              <p className="text-xs text-muted-foreground">
                You saved ${(discountAmount ?? 0).toFixed(2)}
                {originalAmount != null && (
                  <>
                    {" "}
                    off the original ${originalAmount.toFixed(2)}
                  </>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-red-500"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ invoiceId })}
          >
            <XIcon className="size-4" />
            Remove
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <TagIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Have a coupon?</span>
      </div>
      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row">
        <Input
          placeholder="Enter coupon code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.trim()) {
              apply.mutate({ invoiceId, code: code.trim() })
            }
          }}
          className="font-mono uppercase"
        />
        <Button
          disabled={!code.trim() || apply.isPending}
          onClick={() => apply.mutate({ invoiceId, code: code.trim() })}
        >
          {apply.isPending ? "Applying…" : "Apply"}
        </Button>
      </div>
    </div>
  )
}
