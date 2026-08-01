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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
type RdpTarget = {
  id: string
  title: string
  requiresRdp: boolean
  requirements: string[]
}
const EMPTY_RDP = { host: "", username: "", password: "" }

export default function DashboardServicesPage() {
  const router = useRouter()
  const params = useParams()
  const companyId = typeof params?.companyId === "string" ? params.companyId : ""

  const { data: overview } = trpc.companies.getOverview.useQuery(
    { orgId: companyId },
    { enabled: !!companyId },
  )

  const { data: allServices, isLoading: svcLoading } = trpc.services.list.useQuery()

  // RDP details already on file for this company (from a previous order), used
  // to pre-fill the RDP form so it doesn't have to be re-entered.
  const { data: savedRdp } = trpc.serviceOrders.latestRdp.useQuery(
    { organizationId: companyId },
    { enabled: !!companyId },
  )

  const [wpTarget, setWpTarget] = useState<WordpressTarget | null>(null)
  const [rdpTarget, setRdpTarget] = useState<RdpTarget | null>(null)
  const [rdp, setRdp] = useState(EMPTY_RDP)
  const [reqValues, setReqValues] = useState<Record<string, string>>({})

  const purchase = trpc.serviceOrders.purchase.useMutation({
    onSuccess: (order) => {
      setWpTarget(null)
      setRdpTarget(null)
      if (order.invoice) {
        router.push(`/companies/${companyId}/orders/${order.id}`)
      } else {
        toast.success("Submitted for quote — we'll review your design and send an invoice.")
        router.push(`/companies/${companyId}/orders/${order.id}`)
      }
    },
    onError: (err) => toast.error(err.message),
  })

  const buyService = (svc: {
    id: string
    title: string
    price: number
    type: string
    requiresRdp: boolean
    requirements: string[]
  }) => {
    if (svc.type === "wordpress") {
      setWpTarget({ id: svc.id, title: svc.title, price: svc.price })
      return
    }
    const reqs = svc.requirements ?? []
    if (svc.requiresRdp || reqs.length > 0) {
      // Pre-fill RDP from the company's existing RDP if we have it on file.
      setRdp(
        svc.requiresRdp && savedRdp
          ? {
              host: savedRdp.host,
              username: savedRdp.username,
              password: savedRdp.password,
            }
          : EMPTY_RDP,
      )
      setReqValues(Object.fromEntries(reqs.map((l) => [l, ""])))
      setRdpTarget({
        id: svc.id,
        title: svc.title,
        requiresRdp: svc.requiresRdp,
        requirements: reqs,
      })
      return
    }
    purchase.mutate({ organizationId: companyId, serviceId: svc.id })
  }

  const submitRdp = () => {
    if (!rdpTarget) return
    if (
      rdpTarget.requiresRdp &&
      (!rdp.host.trim() || !rdp.username.trim() || !rdp.password.trim())
    ) {
      toast.error("Please provide the RDP host, username and password")
      return
    }
    const missing = rdpTarget.requirements.filter((l) => !reqValues[l]?.trim())
    if (missing.length > 0) {
      toast.error(`Please provide: ${missing.join(", ")}`)
      return
    }
    purchase.mutate({
      organizationId: companyId,
      serviceId: rdpTarget.id,
      ...(rdpTarget.requiresRdp
        ? {
            rdp: {
              host: rdp.host.trim(),
              username: rdp.username.trim(),
              password: rdp.password.trim(),
            },
          }
        : {}),
      ...(rdpTarget.requirements.length > 0
        ? {
            requirements: rdpTarget.requirements.map((l) => ({
              label: l,
              value: reqValues[l].trim(),
            })),
          }
        : {}),
    })
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
    (s) => s.type === "wordpress" || !s.country || s.country === country,
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

      <Dialog
        open={!!rdpTarget}
        onOpenChange={(open) => !open && setRdpTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              {rdpTarget?.title} needs a few details before we can start.
            </DialogDescription>
          </DialogHeader>

          {rdpTarget && rdpTarget.requirements.length > 0 && (
            <div className="space-y-3">
              {rdpTarget.requirements.map((label) => (
                <div key={label} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    value={reqValues[label] ?? ""}
                    onChange={(e) =>
                      setReqValues((p) => ({ ...p, [label]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {rdpTarget?.requiresRdp && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold">RDP access</p>
                <p className="text-xs text-muted-foreground">
                  This service needs remote access to your machine.
                </p>
              </div>
              {savedRdp && (
                <p className="rounded-md border border-sky-500/30 bg-sky-500/5 px-2.5 py-1.5 text-xs text-muted-foreground">
                  Pre-filled from this company&apos;s existing RDP — edit it if
                  it has changed.
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Host / IP address</Label>
                  <Input
                    placeholder="e.g. 203.0.113.10"
                    value={rdp.host}
                    onChange={(e) => setRdp({ ...rdp, host: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input
                    value={rdp.username}
                    onChange={(e) =>
                      setRdp({ ...rdp, username: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input
                    value={rdp.password}
                    onChange={(e) =>
                      setRdp({ ...rdp, password: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRdpTarget(null)}
            >
              Cancel
            </Button>
            <Button onClick={submitRdp} disabled={purchase.isPending}>
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
