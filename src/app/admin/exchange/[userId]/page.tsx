"use client"

import { use } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { ExchangeLedger } from "@/components/exchange-ledger"
import { ArrowLeftIcon } from "lucide-react"

export default function AdminClientExchangePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = use(params)
  const { data: client, isLoading } = trpc.exchange.clientInfo.useQuery({
    userId,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }
  if (!client) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Client not found.</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/exchange">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {client.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {client.email} · Exchange ledger
          </p>
        </div>
      </div>

      <ExchangeLedger mode="admin" userId={userId} />
    </div>
  )
}
