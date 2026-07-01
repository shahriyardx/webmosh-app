"use client"

import { useState, useCallback } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"
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
  packageId: string
  serviceIds: string[]
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
  const [mode, setMode] = useState<"choice" | "create" | "import">("choice")
  const [currentStep, setCurrentStep] = useState<StepId>(firstStep)
  const [formData, setFormData] = useState<Partial<FormValues>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const [nameReady, setNameReady] = useState(false)

  const [importCompanyId, setImportCompanyId] = useState("")
  const [importAuthCode, setImportAuthCode] = useState("")

  const createCompany = trpc.companies.createCompany.useMutation({
    onSuccess: () => {
      router.push("/dashboard")
    },
  })

  const importCompany = trpc.companies.importCompany.useMutation({
    onSuccess: () => {
      // Hard reload so the client session picks up the new active organization
      window.location.href = "/dashboard"
    },
    onError: (e) => toast.error(e.message),
  })

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
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!session) {
    router.push("/")
    return null
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center border-b border-border px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
          <Image src="/logo.png" alt="Webmosh" width={32} height={32} className="size-8 object-contain" />
          <span className="text-sm font-semibold tracking-wide">WEBMOSH</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col">
        {mode === "choice" && (
          <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <h1 className="text-2xl font-semibold text-foreground">Get started</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How would you like to begin?
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card
                role="button"
                tabIndex={0}
                onClick={() => setMode("create")}
                className="cursor-pointer transition-all hover:ring-2 hover:ring-amber-500"
              >
                <CardContent className="flex flex-col gap-3 py-8">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-amber-500/10">
                    <PlusIcon className="size-5 text-amber-500" />
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
                className="cursor-pointer transition-all hover:ring-2 hover:ring-amber-500"
              >
                <CardContent className="flex flex-col gap-3 py-8">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-amber-500/10">
                    <Building2Icon className="size-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">I already have a company</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Import an existing UK company with its Company ID & Auth Code.
                    </p>
                  </div>
                </CardContent>
              </Card>
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
                          ? "bg-amber-500 text-white"
                          : i === currentIdx
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500"
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
                  initialValue={formData.serviceIds}
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
                className="bg-amber-500 hover:bg-amber-600 text-white"
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
    </div>
  )
}
