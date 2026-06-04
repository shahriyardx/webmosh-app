"use client"

import { useState, useCallback } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { StepCountry } from "./steps/step-country"
import { StepName } from "./steps/step-name"
import { StepSic } from "./steps/step-sic"
import { StepDocuments } from "./steps/step-documents"
import { StepDirector } from "./steps/step-director"
import { StepReview } from "./steps/step-review"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  Loader2Icon,
  Building2Icon,
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

type FormValues = {
  country: "us" | "uk"
  companyName: string
  sicCode: string
  sicDescription?: string
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
  { id: "review", label: "Review" },
] as const

export default function OnboardPage() {
  const router = useRouter()
  const { data: session, isPending: authPending } = authClient.useSession()
  const [currentStep, setCurrentStep] = useState(0)
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
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1))
  }, [])

  const triggerNext = useCallback(() => {
    const form = document.getElementById("step-form") as HTMLFormElement | null
    form?.requestSubmit()
  }, [])

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0))
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
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500 text-white">
            <Building2Icon className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-wide">WEBMOSH</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col">
        <div className="w-full flex-1 px-6">
          <div className="mx-auto w-full max-w-7xl py-8">
            {/* Step indicators */}
            <div className="mb-8 flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      i < currentStep
                        ? "bg-amber-500 text-white"
                        : i === currentStep
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < currentStep ? <CheckIcon className="size-4" /> : i + 1}
                  </div>
                  <span
                    className={`text-sm hidden sm:inline ${
                      i === currentStep
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
              ))}
            </div>

            {/* Step content */}
            <div className="w-full">
              {currentStep === 0 && (
                <StepCountry
                  onNext={handleNext}
                  initialValue={formData.country}
                />
              )}
              {currentStep === 1 && (
                <StepName
                  onNext={handleNext}
                  country={formData.country}
                  initialValue={formData.companyName}
                  onReady={setNameReady}
                />
              )}
              {currentStep === 2 && (
                <StepSic
                  onNext={handleNext}
                  country={formData.country}
                  initialCode={formData.sicCode}
                  initialDescription={formData.sicDescription}
                />
              )}
              {currentStep === 3 && (
                <StepDocuments
                  onNext={handleNext}
                  passportUrl={formData.passportUrl}
                  bankStatementUrl={formData.bankStatementUrl}
                  setIsUploading={setIsUploading}
                  onFilesReady={setDocumentsReady}
                />
              )}
              {currentStep === 4 && (
                <StepDirector
                  onNext={handleNext}
                  initialValues={formData.director}
                />
              )}
              {currentStep === 5 && (
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
              disabled={currentStep === 0}
            >
              <ChevronLeftIcon className="mr-1 size-4" />
              Back
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                onClick={triggerNext}
                disabled={
                  isUploading ||
                  (currentStep === 1 && !nameReady) ||
                  (currentStep === 3 && !documentsReady)
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
