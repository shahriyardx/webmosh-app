"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import {
  ConciergeBellIcon,
  Loader2Icon,
  CheckIcon,
  GlobeIcon,
  PaletteIcon,
  type LucideIcon,
} from "lucide-react"
import {
  WordpressCheckoutDialog,
  type WordpressPurchasePayload,
} from "@/components/wordpress-checkout-dialog"

type Service = {
  id: string
  title: string
  description: string
  features: string[]
  price: number
  country: string | null
  type: "general" | "wordpress"
}

export default function AccountServicesPage() {
  const router = useRouter()
  const { data: allServices, isLoading } = trpc.services.list.useQuery()
  const { data: companies } = trpc.companies.myCompanies.useQuery()

  const [picking, setPicking] = useState<Service | null>(null)
  const [orgId, setOrgId] = useState<string>("")
  const [wpFor, setWpFor] = useState<Service | null>(null)

  const purchase = trpc.serviceOrders.purchase.useMutation({
    onSuccess: (order) => {
      setWpFor(null)
      setPicking(null)
      if (!order.invoice) {
        toast.success(
          "Submitted for quote — we'll review your design and send an invoice.",
        )
      }
      router.push(`/account/orders/${order.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const purchaseAsPersonal =
    trpc.serviceOrders.purchaseAsPersonal.useMutation({
      onSuccess: (order) => {
        setWpFor(null)
        setPicking(null)
        if (!order.invoice) {
          toast.success(
            "Submitted for quote — we'll review your design and send an invoice.",
          )
        }
        router.push(`/account/orders/${order.id}`)
      },
      onError: (e) => toast.error(e.message),
    })

  const eligibleCompanies = picking
    ? (companies ?? []).filter(
        (c) =>
          c.type !== "personal" &&
          (picking.type === "wordpress" || c.country === picking.country),
      )
    : []

  const wordpressServices = (allServices ?? []).filter(
    (s) => s.type === "wordpress",
  )
  const usServices = (allServices ?? []).filter(
    (s) => s.type !== "wordpress" && s.country === "us",
  )
  const ukServices = (allServices ?? []).filter(
    (s) => s.type !== "wordpress" && s.country === "uk",
  )

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  const startPurchase = (svc: Service) => {
    if (svc.type === "wordpress") {
      setWpFor(svc)
      return
    }
    setOrgId("")
    setPicking(svc)
  }

  const confirmPurchase = () => {
    if (!picking || !orgId) return
    purchase.mutate({ organizationId: orgId, serviceId: picking.id })
  }

  const submitWordpress = (payload: WordpressPurchasePayload) => {
    if (!wpFor) return
    if (payload.organizationId) {
      purchase.mutate({
        organizationId: payload.organizationId,
        serviceId: wpFor.id,
        wordpress: payload.wordpress,
      })
    } else {
      purchaseAsPersonal.mutate({
        serviceId: wpFor.id,
        wordpress: payload.wordpress,
      })
    }
  }

  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Services
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Browse services and purchase for any of your companies.
        </p>
      </div>

      {wordpressServices.length > 0 && (
        <section className="space-y-4">
          <SectionHeading
            icon={PaletteIcon}
            title="Web development"
            subtitle="Available worldwide — no company required"
          />
          <ServiceGrid services={wordpressServices} onPurchase={startPurchase} />
        </section>
      )}

      {ukServices.length > 0 && (
        <section className="space-y-4">
          <SectionHeading
            icon={GlobeIcon}
            title="United Kingdom"
            subtitle="For your UK companies"
          />
          <ServiceGrid services={ukServices} onPurchase={startPurchase} />
        </section>
      )}

      {usServices.length > 0 && (
        <section className="space-y-4">
          <SectionHeading
            icon={GlobeIcon}
            title="United States"
            subtitle="For your US companies"
          />
          <ServiceGrid services={usServices} onPurchase={startPurchase} />
        </section>
      )}

      {ukServices.length === 0 &&
        usServices.length === 0 &&
        wordpressServices.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
              <ConciergeBellIcon className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No services available yet.
            </p>
          </div>
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
              {picking?.title}
              {picking?.type === "wordpress"
                ? " — available for any of your companies"
                : ` — ${
                    picking?.country === "uk"
                      ? "United Kingdom"
                      : "United States"
                  }`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Company</Label>
            {eligibleCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {picking?.type === "wordpress"
                  ? "You have no companies yet. Create one first."
                  : `You have no ${
                      picking?.country === "uk" ? "UK" : "US"
                    } companies. Create one first.`}
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
              ) : picking?.type === "wordpress" ? (
                "Continue"
              ) : (
                "Purchase"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {wpFor && (
        <WordpressCheckoutDialog
          open={!!wpFor}
          onOpenChange={(open) => !open && setWpFor(null)}
          serviceTitle={wpFor.title}
          servicePrice={wpFor.price}
          loading={purchase.isPending || purchaseAsPersonal.isPending}
          companies={(companies ?? [])
            .filter((c) => c.type !== "personal")
            .map((c) => ({ id: c.id, name: c.name }))}
          onSubmit={submitWordpress}
        />
      )}
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-muted/40">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((svc) => {
        const isWp = svc.type === "wordpress"
        const region = isWp
          ? "Global"
          : svc.country === "uk"
            ? "United Kingdom"
            : svc.country === "us"
              ? "United States"
              : "Global"
        return (
          <div
            key={svc.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-end gap-1.5 p-5 pb-0">
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-600 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
                {isWp ? "WordPress" : "Service"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <GlobeIcon className="size-2.5" />
                {region}
              </span>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-5 pt-3">
              <p className="text-lg font-semibold text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">
                {svc.title}
              </p>
              {svc.description && (
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {svc.description}
                </p>
              )}

              {svc.features.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    What&apos;s included
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {svc.features.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground/90"
                      >
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-muted/20 p-5">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    ${svc.price}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    USD
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isWp ? "one-time project" : "one-time payment"}
                </p>
              </div>
              <Button onClick={() => onPurchase(svc)}>
                {isWp ? "Order Now" : "Purchase"}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
