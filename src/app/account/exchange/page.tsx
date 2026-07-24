"use client"

import { trpc } from "@/lib/trpc/client"
import { ExchangeLedger } from "@/components/exchange-ledger"
import { ArrowLeftRightIcon } from "lucide-react"

export default function ClientExchangePage() {
  const { data: access, isLoading } = trpc.exchange.myAccess.useQuery()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!access?.enabled) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
          <ArrowLeftRightIcon className="size-6 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Exchange isn&apos;t enabled for your account.
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Ask your admin to enable it for you.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10">
          <ArrowLeftRightIcon className="size-5 text-sky-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Exchange</h1>
          <p className="text-sm text-muted-foreground">
            Record your exchanges. New entries are added once an admin approves
            them.
          </p>
        </div>
      </div>

      <ExchangeLedger mode="client" />
    </div>
  )
}
