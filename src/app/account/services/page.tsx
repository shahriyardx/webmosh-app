"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
} from "@/components/ui/multi-select"
import { ConciergeBellIcon, Loader2Icon, CheckIcon } from "lucide-react"

type Service = {
  id: string
  title: string
  description: string
  features: string[]
  price: number
  country: string
}

export default function AccountServicesPage() {
  const router = useRouter()
  const { data: allServices, isLoading } = trpc.services.list.useQuery()
  const { data: companies } = trpc.companies.myCompanies.useQuery()

  const [picking, setPicking] = useState<Service | null>(null)
  const [orgId, setOrgId] = useState<string>("")

  const purchase = trpc.serviceOrders.purchase.useMutation({
    onSuccess: (order) => {
      router.push(`/account/orders/${order.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const eligibleCompanies = picking
    ? (companies ?? []).filter(
        (c) => c.type !== "personal" && c.country === picking.country,
      )
    : []

  const usServices = (allServices ?? []).filter((s) => s.country === "us")
  const ukServices = (allServices ?? []).filter((s) => s.country === "uk")

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  const startPurchase = (svc: Service) => {
    setOrgId("")
    setPicking(svc)
  }

  const confirmPurchase = () => {
    if (!picking || !orgId) return
    purchase.mutate({ organizationId: orgId, serviceId: picking.id })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse services and purchase for any of your companies.
        </p>
      </div>

      {ukServices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            United Kingdom
          </h2>
          <ServiceGrid services={ukServices} onPurchase={startPurchase} />
        </section>
      )}

      {usServices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            United States
          </h2>
          <ServiceGrid services={usServices} onPurchase={startPurchase} />
        </section>
      )}

      {ukServices.length === 0 && usServices.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ConciergeBellIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No services available yet.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!picking}
        onOpenChange={(open) => {
          if (!open) setPicking(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase for which company?</DialogTitle>
            <DialogDescription>
              {picking?.title} —{" "}
              {picking?.country === "uk" ? "United Kingdom" : "United States"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Company</Label>
            {eligibleCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have no{" "}
                {picking?.country === "uk" ? "UK" : "US"} companies. Create one
                first.
              </p>
            ) : (
              <MultiSelect
                single
                values={orgId ? [orgId] : []}
                onValuesChange={(vals) => setOrgId(vals[0] ?? "")}
              >
                <MultiSelectTrigger className="w-full">
                  <MultiSelectValue placeholder="Select a company" />
                </MultiSelectTrigger>
                <MultiSelectContent>
                  {eligibleCompanies.map((c) => (
                    <MultiSelectItem key={c.id} value={c.id}>
                      {c.name}
                    </MultiSelectItem>
                  ))}
                </MultiSelectContent>
              </MultiSelect>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={confirmPurchase}
              disabled={!orgId || purchase.isPending}
            >
              {purchase.isPending ? (
                <>
                  <Loader2Icon className="mr-1 size-3 animate-spin" />
                  Processing…
                </>
              ) : (
                "Purchase"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ServiceGrid({
  services,
  onPurchase,
}: {
  services: Service[]
  onPurchase: (svc: Service) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((svc) => (
        <Card key={svc.id} className="flex flex-col">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-sky-500/10">
              <ConciergeBellIcon className="size-5 text-sky-500" />
            </div>
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
          <CardFooter className="mt-auto justify-between">
            <span className="text-lg font-bold text-foreground">
              ${svc.price}
            </span>
            <Button size="sm" onClick={() => onPurchase(svc)}>
              Purchase
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
