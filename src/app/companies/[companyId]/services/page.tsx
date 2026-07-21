"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
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
  ConciergeBellIcon,
  Loader2Icon,
  CheckIcon,
} from "lucide-react"
import {
  WordpressCheckoutDialog,
  type WordpressPurchasePayload,
} from "@/components/wordpress-checkout-dialog"

type WordpressTarget = { id: string; title: string; price: number }

export default function DashboardServicesPage() {
  const router = useRouter()
  const params = useParams()
  const companyId = typeof params?.companyId === "string" ? params.companyId : ""

  const { data: overview } = trpc.companies.getOverview.useQuery(
    { orgId: companyId },
    { enabled: !!companyId },
  )

  const { data: allServices, isLoading: svcLoading } = trpc.services.list.useQuery()

  const [wpTarget, setWpTarget] = useState<WordpressTarget | null>(null)

  const purchase = trpc.serviceOrders.purchase.useMutation({
    onSuccess: (order) => {
      setWpTarget(null)
      if (order.invoice) {
        router.push(`/companies/${companyId}/orders/${order.id}`)
      } else {
        toast.success("Submitted for quote — we'll review your design and send an invoice.")
        router.push(`/companies/${companyId}/orders/${order.id}`)
      }
    },
    onError: (err) => toast.error(err.message),
  })

  const buyService = (svc: { id: string; title: string; price: number; type: string }) => {
    if (svc.type === "wordpress") {
      setWpTarget({ id: svc.id, title: svc.title, price: svc.price })
      return
    }
    purchase.mutate({ organizationId: companyId, serviceId: svc.id })
  }

  const submitWordpress = (payload: WordpressPurchasePayload) => {
    if (!wpTarget) return
    purchase.mutate({
      organizationId: payload.organizationId ?? companyId,
      serviceId: wpTarget.id,
      wordpress: payload.wordpress,
    })
  }

  const country = overview?.country

  const filtered = (allServices ?? []).filter(
    (s) => s.type === "wordpress" || s.country === country,
  )

  if (svcLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase additional services for your company.
        </p>
      </div>

      {!country ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ConciergeBellIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No company found. Start by forming a company first.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ConciergeBellIcon className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No services available for{" "}
              {country === "uk" ? "United Kingdom" : "United States"} yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((svc) => {
            const loading = purchase.isPending && purchase.variables?.serviceId === svc.id
            return (
              <Card key={svc.id} className="flex flex-col">
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
                <CardFooter className="mt-auto justify-between">
                  <span className="text-lg font-bold text-foreground">${svc.price}</span>
                  <Button
                    size="sm"
                    onClick={() => buyService(svc)}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2Icon className="mr-1 size-3 animate-spin" />
                        Processing…
                      </>
                    ) : svc.type === "wordpress" ? (
                      "Order Now"
                    ) : (
                      "Purchase"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {wpTarget && (
        <WordpressCheckoutDialog
          open={!!wpTarget}
          onOpenChange={(open) => !open && setWpTarget(null)}
          serviceTitle={wpTarget.title}
          servicePrice={wpTarget.price}
          loading={purchase.isPending}
          onSubmit={submitWordpress}
        />
      )}
    </div>
  )
}
