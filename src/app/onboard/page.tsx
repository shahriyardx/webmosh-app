"use client"

import { useState, useCallback } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
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
  const [currentStep, setCurrentStep] = useState<StepId>(firstStep)
  const [formData, setFormData] = useState<Partial<FormValues>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const [nameReady, setNameReady] = useState(false)

  const createCompany = trpc.companies.createCompany.useMutation({
    onSuccess: () => {
      router.push("/dashboard")
    },
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
      </main>
    </div>
  )
}
