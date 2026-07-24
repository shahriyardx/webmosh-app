"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ArrowLeftRightIcon,
  UsersIcon,
  UserPlusIcon,
  SearchIcon,
  ArrowRightIcon,
} from "lucide-react"

export default function AdminExchangePage() {
  const utils = trpc.useUtils()
  const { data: clients, isLoading } = trpc.exchange.enabledClients.useQuery()

  const [manageOpen, setManageOpen] = useState(false)

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10">
            <ArrowLeftRightIcon className="size-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Exchange</h1>
            <p className="text-sm text-muted-foreground">
              Clients with the exchange feature. Pick one to view their ledger.
            </p>
          </div>
        </div>
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlusIcon className="size-4" />
              Manage access
            </Button>
          </DialogTrigger>
          <ManageAccessDialog
            onChanged={() => utils.exchange.enabledClients.invalidate()}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
        </div>
      ) : !clients?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <UsersIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No clients have the exchange feature yet.
            </p>
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <UserPlusIcon className="size-4" />
              Grant access to a client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/exchange/${c.id}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-sky-500/40 hover:bg-muted/30"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                  {c.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.txCount} transaction{c.txCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {c.pendingCount > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {c.pendingCount} pending
                  </span>
                )}
                <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ManageAccessDialog({ onChanged }: { onChanged: () => void }) {
  const utils = trpc.useUtils()
  const { data: allClients } = trpc.exchange.allClients.useQuery()
  const [search, setSearch] = useState("")

  const setEnabled = trpc.exchange.setEnabled.useMutation({
    onSuccess: () => {
      utils.exchange.allClients.invalidate()
      onChanged()
    },
    onError: (e) => toast.error(e.message),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = allClients ?? []
    if (!q) return list
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    )
  }, [allClients, search])

  return (
    <DialogContent className="max-h-[85dvh] max-w-lg overflow-hidden">
      <DialogHeader>
        <DialogTitle>Exchange access</DialogTitle>
        <DialogDescription>
          Turn the exchange feature on or off for any client.
        </DialogDescription>
      </DialogHeader>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="pl-9"
        />
      </div>
      <div className="-mx-1 max-h-[55dvh] space-y-1 overflow-y-auto px-1">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.email}</p>
            </div>
            <Button
              size="sm"
              variant={c.exchangeEnabled ? "outline" : "default"}
              disabled={setEnabled.isPending}
              className={c.exchangeEnabled ? "text-red-500" : ""}
              onClick={() =>
                setEnabled.mutate({
                  userId: c.id,
                  enabled: !c.exchangeEnabled,
                })
              }
            >
              {c.exchangeEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No clients found.
          </p>
        )}
      </div>
    </DialogContent>
  )
}
