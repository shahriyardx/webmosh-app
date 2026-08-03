"use client"

import { useId, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  UploadIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react"

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
]

type DocFiles = {
  certificate?: File
  articles?: File
  einLetter?: File
  passport?: File
}

function FileField({
  label,
  file,
  onPick,
}: {
  label: string
  file?: File
  onPick: (f: File | undefined) => void
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm transition-colors hover:border-sky-500/40"
      >
        <UploadIcon className="size-4 shrink-0 text-muted-foreground" />
        <span
          className={
            file ? "truncate text-foreground" : "text-muted-foreground"
          }
        >
          {file ? file.name : "Click to upload (PDF, PNG, JPG)"}
        </span>
        {file && (
          <CheckCircle2Icon className="ml-auto size-4 shrink-0 text-emerald-500" />
        )}
      </label>
      <input
        id={id}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </div>
  )
}

function ModeButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/40"
          : "border-border hover:border-sky-500/40"
      }`}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </button>
  )
}

export function UsCompanyImport({
  onDone,
}: {
  onDone: (orgId: string) => void
}) {
  const [companyName, setCompanyName] = useState("")
  const [companyNumber, setCompanyNumber] = useState("")
  const [state, setState] = useState("")
  const [registeredAddress, setRegisteredAddress] = useState("")
  const [ein, setEin] = useState("")
  const [directorName, setDirectorName] = useState("")
  const [directorDob, setDirectorDob] = useState("")
  const [directorEmail, setDirectorEmail] = useState("")
  const [directorPhone, setDirectorPhone] = useState("")
  const [docMode, setDocMode] = useState<"now" | "later">("now")
  const [files, setFiles] = useState<DocFiles>({})
  const [uploading, setUploading] = useState(false)

  const importUs = trpc.companies.importUsCompany.useMutation({
    onSuccess: (org) => onDone(org.id),
    onError: (e) => {
      toast.error(e.message)
      setUploading(false)
    },
  })
  const busy = uploading || importUs.isPending

  const setFile = (key: keyof DocFiles, f: File | undefined) =>
    setFiles((prev) => ({ ...prev, [key]: f }))

  const submit = async () => {
    if (
      !companyName.trim() ||
      !state ||
      !registeredAddress.trim() ||
      !directorName.trim() ||
      !directorDob
    ) {
      toast.error("Please fill in all required fields.")
      return
    }

    const baseInput = {
      companyName: companyName.trim(),
      companyNumber: companyNumber.trim() || undefined,
      state,
      registeredAddress: registeredAddress.trim(),
      ein: ein.trim() || undefined,
      director: {
        name: directorName.trim(),
        dateOfBirth: directorDob,
        email: directorEmail.trim() || undefined,
        phone: directorPhone.trim() || undefined,
      },
    }

    // Upload later: skip the files entirely — the backend creates document
    // placeholders the client can fulfil from their dashboard.
    if (docMode === "later") {
      importUs.mutate(baseInput)
      return
    }

    const { certificate, articles, einLetter, passport } = files
    if (!certificate || !articles || !einLetter || !passport) {
      toast.error(
        "Please upload all four documents, or choose “Upload later”.",
      )
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append("certificate", certificate)
      body.append("articles", articles)
      body.append("einLetter", einLetter)
      body.append("passport", passport)
      const res = await fetch("/api/upload", { method: "POST", body })
      if (!res.ok) throw new Error("Document upload failed. Please try again.")
      const data = (await res.json()) as {
        files: { name: string; url: string }[]
      }
      const urlOf = (n: string) => data.files.find((f) => f.name === n)?.url
      const certificateUrl = urlOf("certificate")
      const articlesUrl = urlOf("articles")
      const einLetterUrl = urlOf("einLetter")
      const passportUrl = urlOf("passport")
      if (!certificateUrl || !articlesUrl || !einLetterUrl || !passportUrl) {
        throw new Error("Document upload failed. Please try again.")
      }
      importUs.mutate({
        ...baseInput,
        certificateUrl,
        articlesUrl,
        einLetterUrl,
        passportUrl,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.")
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Company details */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Company details
        </h3>
        <div className="space-y-1.5">
          <Label>Company name *</Label>
          <Input
            placeholder="e.g. Acme Ventures LLC"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company number</Label>
            <Input
              placeholder="State registration number"
              value={companyNumber}
              onChange={(e) => setCompanyNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State *</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Registered address *</Label>
          <Textarea
            className="min-h-20"
            placeholder="Street, City, State, ZIP"
            value={registeredAddress}
            onChange={(e) => setRegisteredAddress(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>EIN number</Label>
          <Input
            placeholder="e.g. 88-1234567"
            value={ein}
            onChange={(e) => setEin(e.target.value)}
          />
        </div>
      </div>

      {/* Director */}
      <div className="space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Director</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Director name *</Label>
            <Input
              placeholder="Full name"
              value={directorName}
              onChange={(e) => setDirectorName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date of birth *</Label>
            <Input
              type="date"
              value={directorDob}
              onChange={(e) => setDirectorDob(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="director@example.com"
              value={directorEmail}
              onChange={(e) => setDirectorEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              type="tel"
              placeholder="+1 555 123 4567"
              value={directorPhone}
              onChange={(e) => setDirectorPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-4 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Documents</h3>

        {/* Upload now / later choice */}
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={docMode === "now"}
            title="Upload now"
            subtitle="Attach documents today"
            onClick={() => setDocMode("now")}
          />
          <ModeButton
            active={docMode === "later"}
            title="Upload later"
            subtitle="Add them from your dashboard"
            onClick={() => setDocMode("later")}
          />
        </div>

        {docMode === "now" ? (
          <div className="space-y-4">
            <FileField
              label="Director passport *"
              file={files.passport}
              onPick={(f) => setFile("passport", f)}
            />
            <FileField
              label="Certificate of Incorporation *"
              file={files.certificate}
              onPick={(f) => setFile("certificate", f)}
            />
            <FileField
              label="Articles of Organization *"
              file={files.articles}
              onPick={(f) => setFile("articles", f)}
            />
            <FileField
              label="EIN Letter *"
              file={files.einLetter}
              onPick={(f) => setFile("einLetter", f)}
            />
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            No problem — we&apos;ll add the passport, certificate, articles and
            EIN letter as pending items. You can upload each one later from your
            company&apos;s documents page.
          </p>
        )}
      </div>

      <Button className="w-full" onClick={submit} disabled={busy}>
        {busy ? (
          <>
            <Loader2Icon className="mr-1 size-4 animate-spin" />
            {uploading && !importUs.isPending ? "Uploading…" : "Importing…"}
          </>
        ) : (
          "Import Company"
        )}
      </Button>
    </div>
  )
}
