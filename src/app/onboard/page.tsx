"use client"

import { useState, useCallback } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import { authClient } from "@/lib/auth-client"
import {
  WordpressCheckoutDialog,
  type WordpressPurchasePayload,
} from "@/components/wordpress-checkout-dialog"
import { StepCountry } from "./steps/step-country"
import { StepName } from "./steps/step-name"
import { StepSic } from "./steps/step-sic"
import { StepPackage } from "./steps/step-package"
import { StepServices } from "./steps/step-services"
import { StepDocuments } from "./steps/step-documents"
import { StepDirector } from "./steps/step-director"
import { StepReview } from "./steps/step-review"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  Loader2Icon,
  Building2Icon,
  PlusIcon,
  ArrowLeftIcon,
  UserIcon,
  LogOutIcon,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"

const directorSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  address: z.string().min(1, "Residential address is required"),
})

export type FormValues = {
  country: "us" | "uk"
  companyName: string
  sicCode: string
  sicDescription?: string
  website?: string
  packageId: string
  serviceIds: string[]
  wordpressOrders: {
    serviceId: string
    wordpress: WordpressPurchasePayload["wordpress"]
  }[]
  passportUrl: string
  bankStatementUrl: string
  director: z.infer<typeof directorSchema>
}

const steps = [
  { id: "country", label: "Country" },
  { id: "name", label: "Company Name" },
  { id: "sic", label: "SIC Code" },
  { id: "documents", label: "Documents" },
  { id: "director", label: "Director" },
  { id: "package", label: "Package" },
  { id: "services", label: "Services" },
  { id: "review", label: "Review" },
] as const

type StepId = (typeof steps)[number]["id"]

const firstStep: StepId = steps[0].id
const lastStep: StepId = steps[steps.length - 1].id

function stepIndex(id: StepId): number {
  return steps.findIndex((s) => s.id === id)
}

function nextStep(id: StepId): StepId | null {
  const idx = stepIndex(id)
  return idx < steps.length - 1 ? steps[idx + 1].id : null
}

function prevStep(id: StepId): StepId | null {
  const idx = stepIndex(id)
  return idx > 0 ? steps[idx - 1].id : null
}

export default function OnboardPage() {
  const router = useRouter()
  const { data: session, isPending: authPending } = authClient.useSession()
  const [mode, setMode] = useState<"choice" | "create" | "import" | "personal">(
    "choice",
  )
  const [personalServiceIds, setPersonalServiceIds] = useState<string[]>([])
  const [personalCheckout, setPersonalCheckout] = useState<{
    organizationId: string
    invoiceId: string
    invoiceNumber: number
    amount: number
    items: { title: string; amount: number }[]
    paid: boolean
  } | null>(null)
  const [personalTxnId, setPersonalTxnId] = useState("")

  const QR_CONTENT =
    "00020101021126540013com.pathaopay01020302041008031991008200186593649045204739953030505802BD5907WEBMOSH60045460625002110186593649003085594973007082f9893880807PAYMENT63049E3F"
  const [currentStep, setCurrentStep] = useState<StepId>(firstStep)
  const [formData, setFormData] = useState<Partial<FormValues>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const [nameReady, setNameReady] = useState(false)

  const [importCompanyId, setImportCompanyId] = useState("")
  const [importAuthCode, setImportAuthCode] = useState("")

  const utils = trpc.useUtils()

  const { data: settings } = trpc.settings.getAll.useQuery(undefined, {
    enabled: mode === "personal",
  })
  const usdToBdtRate = settings?.usd_to_bdt_rate
    ? parseFloat(settings.usd_to_bdt_rate)
    : null
  const bdtAmount =
    usdToBdtRate && personalCheckout
      ? (personalCheckout.amount * usdToBdtRate).toFixed(2)
      : null

  const createCompany = trpc.companies.createCompany.useMutation({
    onSuccess: (org) => {
      utils.companies.myCompanies.invalidate()
      utils.companies.hasPersonalCompany.invalidate()
      router.push(`/companies/${org.id}/overview`)
    },
  })

  const importCompany = trpc.companies.importCompany.useMutation({
    onSuccess: (org) => {
      utils.companies.myCompanies.invalidate()
      router.push(`/companies/${org.id}/overview`)
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: hasPersonal } = trpc.companies.hasPersonalCompany.useQuery()
  const { data: services, isLoading: servicesLoading } = trpc.services.list.useQuery(
    undefined,
    { enabled: mode === "personal" },
  )

  const checkoutPersonal = trpc.serviceOrders.checkoutPersonal.useMutation({
    onSuccess: (data) => {
      utils.companies.myCompanies.invalidate()
      utils.companies.hasPersonalCompany.invalidate()
      setPersonalCheckout({ ...data, paid: false })
    },
    onError: (e) => toast.error(e.message),
  })

  const [wpTarget, setWpTarget] = useState<{
    id: string
    title: string
    price: number
  } | null>(null)

  const purchaseAsPersonal = trpc.serviceOrders.purchaseAsPersonal.useMutation({
    onSuccess: async (order) => {
      await utils.companies.myCompanies.invalidate()
      await utils.companies.hasPersonalCompany.invalidate()
      setWpTarget(null)
      if (order.invoice) {
        router.push(`/account/invoices/${order.invoice.id}`)
      } else {
        toast.success(
          "Submitted for quote — we'll review your design and send an invoice.",
        )
        router.push(`/account/orders/${order.id}`)
      }
    },
    onError: (e) => toast.error(e.message),
  })

  const submitPersonalPayment = trpc.invoices.submitTransaction.useMutation({
    onSuccess: () => {
      setPersonalCheckout((c) => (c ? { ...c, paid: true } : c))
      toast.success("Payment submitted — we'll verify shortly.")
    },
    onError: (e) => toast.error(e.message),
  })

  const togglePersonalService = (id: string) => {
    setPersonalServiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleNext = useCallback((stepData: Partial<FormValues>) => {
    setFormData((prev) => ({ ...prev, ...stepData }))
    setCurrentStep((prev) => nextStep(prev) ?? prev)
  }, [])

  const triggerNext = useCallback(() => {
    const form = document.getElementById("step-form") as HTMLFormElement | null
    form?.requestSubmit()
  }, [])

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => prevStep(prev) ?? prev)
  }, [])

  if (authPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!session) {
    router.push("/")
    return null
  }

  if (session.user?.role === "freelancer") {
    router.push("/freelancer")
    return null
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center border-b border-border px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
          <Image src="/logo.png" alt="Webmosh" width={32} height={32} className="size-8 object-contain" />
          <span className="text-sm font-semibold tracking-wide">WEBMOSH</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={async () => {
              await authClient.signOut()
              router.push("/")
            }}
          >
            <LogOutIcon className="size-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col">
        {mode === "choice" && (
          <div className="mx-auto w-full max-w-5xl px-6 py-12">
            <h1 className="text-2xl font-semibold text-foreground">Get started</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How would you like to begin?
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card
                role="button"
                tabIndex={0}
                onClick={() => setMode("create")}
                className="cursor-pointer transition-all hover:ring-2 hover:ring-sky-500"
              >
                <CardContent className="flex flex-col gap-3 py-8">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-sky-500/10">
                    <PlusIcon className="size-5 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Create a company</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Form a new UK or US company from scratch.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card
                role="button"
                tabIndex={0}
                onClick={() => setMode("import")}
                className="cursor-pointer transition-all hover:ring-2 hover:ring-sky-500"
              >
                <CardContent className="flex flex-col gap-3 py-8">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-sky-500/10">
                    <Building2Icon className="size-5 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">I already have a company</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Import an existing UK company with its Company ID & Auth Code.
                    </p>
                  </div>
                </CardContent>
              </Card>
              {!hasPersonal && (
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => setMode("personal")}
                  className="cursor-pointer transition-all hover:ring-2 hover:ring-sky-500"
                >
                  <CardContent className="flex flex-col gap-3 py-8">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-sky-500/10">
                      <UserIcon className="size-5 text-sky-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        I don&apos;t have a company
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Just want a service? Pick from our catalog and pay.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {mode === "import" && (
          <div className="mx-auto w-full max-w-md px-6 py-12">
            <button
              type="button"
              onClick={() => setMode("choice")}
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-4" />
              Back
            </button>
            <h1 className="text-2xl font-semibold text-foreground">Import your company</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your UK Company ID and Authentication Code. We&apos;ll pull your
              details from Companies House.
            </p>
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Company ID (Companies House)</Label>
                <Input
                  placeholder="e.g. 12345678"
                  value={importCompanyId}
                  onChange={(e) => setImportCompanyId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Authentication Code</Label>
                <Input
                  placeholder="Enter auth code"
                  value={importAuthCode}
                  onChange={(e) => setImportAuthCode(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() =>
                  importCompany.mutate({
                    companyId: importCompanyId.trim(),
                    authCode: importAuthCode.trim(),
                  })
                }
                disabled={!importCompanyId || !importAuthCode || importCompany.isPending}
              >
                {importCompany.isPending ? (
                  <>
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import Company"
                )}
              </Button>
            </div>
          </div>
        )}

        {mode === "personal" && personalCheckout && (
          <div className="mx-auto w-full max-w-xl px-6 py-12">
            {!personalCheckout.paid ? (
              <>
                <h1 className="text-2xl font-semibold text-foreground">
                  Payment
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invoice {formatInvoiceNumber(personalCheckout.invoiceNumber)}
                </p>

                {/* Items summary */}
                <div className="mt-6 rounded-xl border border-border">
                  <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                    Order summary
                  </div>
                  <div className="divide-y divide-border">
                    {personalCheckout.items.map((it, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-5 py-3 text-sm"
                      >
                        <span>{it.title}</span>
                        <span className="font-medium">
                          ${it.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-muted/40 px-5 py-3 text-base font-bold">
                      <span>Total Due</span>
                      <div className="text-right">
                        <p className="text-sky-500">
                          ${personalCheckout.amount.toFixed(2)}
                        </p>
                        {bdtAmount && (
                          <p className="text-xs font-medium text-muted-foreground">
                            ৳{bdtAmount} BDT
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR + txn id */}
                <div className="mt-6 rounded-xl border border-border">
                  <div className="border-b border-border px-5 py-3 text-sm font-semibold">
                    Pay with Bangla QR
                  </div>
                  <div className="space-y-5 px-5 py-4">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-xl bg-white p-4">
                        <QRCodeSVG value={QR_CONTENT} size={220} level="M" />
                      </div>
                      <p className="text-center text-sm text-muted-foreground">
                        Scan with any Bangla QR enabled app (bKash, Nagad,
                        Rocket, bank app) and pay{" "}
                        {bdtAmount ? (
                          <strong>৳{bdtAmount}</strong>
                        ) : (
                          <strong>${personalCheckout.amount.toFixed(2)}</strong>
                        )}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Transaction ID (TrxID)</Label>
                      <Input
                        placeholder="Paste the transaction ID after paying"
                        value={personalTxnId}
                        onChange={(e) => setPersonalTxnId(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() =>
                        submitPersonalPayment.mutate({
                          invoiceId: personalCheckout.invoiceId,
                          paymentMethod: "BanglaQR",
                          transactionId: personalTxnId,
                        })
                      }
                      disabled={
                        !personalTxnId || submitPersonalPayment.isPending
                      }
                    >
                      {submitPersonalPayment.isPending
                        ? "Submitting…"
                        : "Confirm Payment"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckIcon className="size-7 text-emerald-500" />
                </div>
                <h1 className="mt-4 text-2xl font-semibold text-foreground">
                  Payment submitted
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We&apos;ve received your transaction and will verify it shortly.
                  You can head to your dashboard now — the invoice status will
                  update once verified.
                </p>
                <Button
                  className="mt-6"
                  onClick={async () => {
                    // Prime the cache so the dashboard guard doesn't see the
                    // stale empty [] from a prior visit and bounce back here.
                    await utils.companies.myCompanies.refetch()
                    router.push("/dashboard")
                  }}
                >
                  Go to Dashboard
                  <ChevronRightIcon className="ml-1 size-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {mode === "personal" && !personalCheckout && (
          <div className="mx-auto w-full max-w-5xl px-6 py-12">
            <button
              type="button"
              onClick={() => {
                setMode("choice")
                setPersonalServiceIds([])
              }}
              className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-4" />
              Back
            </button>
            <h1 className="text-2xl font-semibold text-foreground">
              Choose your services
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select at least one service to continue. We&apos;ll set up your
              personal account and take you straight to checkout.
            </p>

            {servicesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
              </div>
            ) : !services?.length ? (
              <div className="mt-8 rounded-xl border border-border px-5 py-8 text-center text-sm text-muted-foreground">
                No services are available right now.
              </div>
            ) : (
              (() => {
                const wpServices = services.filter((s) => s.type === "wordpress")
                const generalServices = services.filter(
                  (s) => s.type !== "wordpress",
                )
                return (
                  <div className="mt-8 space-y-8">
                    {wpServices.length > 0 && (
                      <div>
                        <h2 className="text-sm font-medium text-muted-foreground">
                          Web development
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ordered individually with theme + hosting details.
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {wpServices.map((svc) => (
                            <Card
                              key={svc.id}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setWpTarget({
                                  id: svc.id,
                                  title: svc.title,
                                  price: svc.price,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  setWpTarget({
                                    id: svc.id,
                                    title: svc.title,
                                    price: svc.price,
                                  })
                                }
                              }}
                              className="relative flex cursor-pointer flex-col transition-all hover:ring-2 hover:ring-sky-500"
                            >
                              <CardContent className="flex flex-1 flex-col gap-3 py-6">
                                <div>
                                  <div className="flex items-baseline gap-2">
                                    <h3 className="font-semibold text-foreground">
                                      {svc.title}
                                    </h3>
                                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-500">
                                      WordPress
                                    </span>
                                  </div>
                                  {svc.description && (
                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                      {svc.description}
                                    </p>
                                  )}
                                </div>
                                {svc.features.length > 0 && (
                                  <ul className="space-y-1">
                                    {svc.features.slice(0, 3).map((f, i) => (
                                      <li
                                        key={i}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                      >
                                        <CheckIcon className="size-3 shrink-0 text-emerald-500" />
                                        {f}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div className="mt-auto flex items-baseline justify-between pt-3">
                                  <span className="text-base font-bold text-foreground">
                                    From ${svc.price}
                                  </span>
                                  <span className="text-xs text-sky-500">
                                    Configure →
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {generalServices.length > 0 && (
                      <div>
                        <h2 className="text-sm font-medium text-muted-foreground">
                          Other services
                        </h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {generalServices.map((svc) => {
                            const isSelected = personalServiceIds.includes(
                              svc.id,
                            )
                            return (
                              <Card
                                key={svc.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => togglePersonalService(svc.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    togglePersonalService(svc.id)
                                  }
                                }}
                                className={`relative flex cursor-pointer flex-col transition-all ${
                                  isSelected
                                    ? "ring-2 ring-sky-500"
                                    : "hover:ring-foreground/20"
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-sky-500 text-white">
                                    <CheckIcon className="size-3" />
                                  </div>
                                )}
                                <CardContent className="flex flex-1 flex-col gap-3 py-6">
                                  <div>
                                    <div className="flex items-baseline gap-2">
                                      <h3 className="font-semibold text-foreground">
                                        {svc.title}
                                      </h3>
                                      {svc.country && (
                                        <span className="text-xs uppercase text-muted-foreground">
                                          {svc.country}
                                        </span>
                                      )}
                                    </div>
                                    {svc.description && (
                                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                        {svc.description}
                                      </p>
                                    )}
                                  </div>
                                  {svc.features.length > 0 && (
                                    <ul className="space-y-1">
                                      {svc.features.slice(0, 3).map((f, i) => (
                                        <li
                                          key={i}
                                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                        >
                                          <CheckIcon className="size-3 shrink-0 text-emerald-500" />
                                          {f}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  <div className="mt-auto flex items-baseline justify-between pt-3">
                                    <span className="text-base font-bold text-foreground">
                                      ${svc.price}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()
            )}

            {/* Footer with total + continue */}
            <div className="mt-8 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-5 py-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {personalServiceIds.length}{" "}
                  service{personalServiceIds.length === 1 ? "" : "s"} selected
                </p>
                <p className="text-xl font-bold text-foreground">
                  $
                  {(services ?? [])
                    .filter((s) => personalServiceIds.includes(s.id))
                    .reduce((t, s) => t + s.price, 0)
                    .toFixed(2)}
                </p>
              </div>
              <Button
                disabled={
                  personalServiceIds.length === 0 || checkoutPersonal.isPending
                }
                onClick={() =>
                  checkoutPersonal.mutate({ serviceIds: personalServiceIds })
                }
              >
                {checkoutPersonal.isPending ? (
                  <>
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    Continue to payment
                    <ChevronRightIcon className="ml-1 size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {mode === "create" && (
        <>
        <div className="w-full flex-1 px-6">
          <div className="mx-auto w-full max-w-7xl py-8">
            {/* Step indicators */}
            <div className="mb-8 flex items-center gap-2">
              {steps.map((s, i) => {
                const currentIdx = stepIndex(currentStep)
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div
                      className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        i < currentIdx
                          ? "bg-sky-500 text-white"
                          : i === currentIdx
                            ? "bg-sky-500/10 text-sky-500 border border-sky-500"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i < currentIdx ? <CheckIcon className="size-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-sm hidden sm:inline ${
                        i === currentIdx
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </span>
                    {i < steps.length - 1 && (
                      <div className="mx-2 w-px h-4 bg-border hidden sm:block" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Step content */}
            <div className="w-full">
              {currentStep === "country" && (
                <StepCountry
                  onNext={handleNext}
                  initialValue={formData.country}
                />
              )}
              {currentStep === "name" && (
                <StepName
                  onNext={handleNext}
                  country={formData.country}
                  initialValue={formData.companyName}
                  onReady={setNameReady}
                />
              )}
              {currentStep === "sic" && (
                <StepSic
                  onNext={handleNext}
                  country={formData.country}
                  initialCode={formData.sicCode}
                  initialDescription={formData.sicDescription}
                  initialWebsite={formData.website}
                />
              )}
              {currentStep === "documents" && (
                <StepDocuments
                  onNext={handleNext}
                  passportUrl={formData.passportUrl}
                  bankStatementUrl={formData.bankStatementUrl}
                  setIsUploading={setIsUploading}
                  onFilesReady={setDocumentsReady}
                />
              )}
              {currentStep === "director" && (
                <StepDirector
                  onNext={handleNext}
                  initialValues={formData.director}
                />
              )}
              {currentStep === "package" && (
                <StepPackage
                  onNext={handleNext}
                  country={formData.country}
                  initialValue={formData.packageId}
                />
              )}
              {currentStep === "services" && (
                <StepServices
                  onNext={handleNext}
                  country={formData.country}
                  companyName={formData.companyName}
                  initialValue={formData.serviceIds}
                  initialWordpress={formData.wordpressOrders}
                />
              )}
              {currentStep === "review" && (
                <StepReview data={formData as FormValues} />
              )}
            </div>
          </div>
        </div>

        {/* Navigation — pinned to bottom */}
        <div className="border-t border-border px-6">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between py-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === firstStep}
            >
              <ChevronLeftIcon className="mr-1 size-4" />
              Back
            </Button>

            {currentStep !== lastStep ? (
              <Button
                onClick={triggerNext}
                disabled={
                  isUploading ||
                  (currentStep === "name" && !nameReady) ||
                  (currentStep === "documents" && !documentsReady)
                }
              >
                {isUploading ? (
                  <>
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRightIcon className="ml-1 size-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="bg-sky-500 hover:bg-sky-600 text-white"
                onClick={() => createCompany.mutate(formData as FormValues)}
                disabled={createCompany.isPending}
              >
                {createCompany.isPending ? (
                  <>
                    <Loader2Icon className="mr-1 size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Place Order"
                )}
              </Button>
            )}
          </div>
        </div>
        </>
        )}
      </main>

      {wpTarget && (
        <WordpressCheckoutDialog
          open={!!wpTarget}
          onOpenChange={(open) => !open && setWpTarget(null)}
          serviceTitle={wpTarget.title}
          servicePrice={wpTarget.price}
          loading={purchaseAsPersonal.isPending}
          onSubmit={(payload: WordpressPurchasePayload) =>
            purchaseAsPersonal.mutate({
              serviceId: wpTarget.id,
              wordpress: payload.wordpress,
            })
          }
        />
      )}
    </div>
  )
}
