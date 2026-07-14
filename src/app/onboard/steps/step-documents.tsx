"use client"

import { useRef, useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  UploadIcon,
  FileIcon,
  XIcon,
  IdCardIcon,
  LandmarkIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const schema = z.object({
  passportUrl: z.string().optional(),
  bankStatementUrl: z.string().optional(),
})

type Schema = z.infer<typeof schema>

type DocKey = "passport" | "bankStatement"

interface StepDocumentsProps {
  onNext: (data: { passportUrl: string; bankStatementUrl: string }) => void
  passportUrl?: string
  bankStatementUrl?: string
  setIsUploading?: (v: boolean) => void
  onFilesReady?: (v: boolean) => void
}

const docConfig: Record<
  DocKey,
  { label: string; desc: string; icon: typeof IdCardIcon }
> = {
  passport: {
    label: "Passport",
    desc: "Clear copy of your passport photo page",
    icon: IdCardIcon,
  },
  bankStatement: {
    label: "Bank Statement",
    desc: "Last 3 months — PDF or image",
    icon: LandmarkIcon,
  },
}

export function StepDocuments({
  onNext,
  passportUrl: initialPassportUrl,
  bankStatementUrl: initialBankStatementUrl,
  setIsUploading,
  onFilesReady,
}: StepDocumentsProps) {
  const [selectedPassport, setSelectedPassport] = useState<File | null>(null)
  const [selectedBankStatement, setSelectedBankStatement] =
    useState<File | null>(null)

  const {
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      passportUrl: initialPassportUrl || "",
      bankStatementUrl: initialBankStatementUrl || "",
    },
  })

  const alreadyUploaded = !!(initialPassportUrl && initialBankStatementUrl)
  const filesReady =
    alreadyUploaded || !!(selectedPassport && selectedBankStatement)

  useEffect(() => {
    onFilesReady?.(filesReady)
  }, [filesReady, onFilesReady])

  const files: Record<DocKey, File | null> = {
    passport: selectedPassport,
    bankStatement: selectedBankStatement,
  }

  const handleFileChange = (key: DocKey, file: File | null) => {
    if (key === "passport") setSelectedPassport(file)
    else setSelectedBankStatement(file)
  }

  const onSubmit = async () => {
    if (alreadyUploaded && initialPassportUrl && initialBankStatementUrl) {
      onNext({
        passportUrl: initialPassportUrl,
        bankStatementUrl: initialBankStatementUrl,
      })
      return
    }

    if (!selectedPassport || !selectedBankStatement) return

    setIsUploading?.(true)
    try {
      const body = new FormData()
      body.append("passport", selectedPassport)
      body.append("bankStatement", selectedBankStatement)
      const res = await fetch("/api/upload", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const pUrl = data.files.find(
        (f: { name: string }) => f.name === "passport",
      )?.url
      const bUrl = data.files.find(
        (f: { name: string }) => f.name === "bankStatement",
      )?.url
      if (!pUrl || !bUrl) throw new Error("Upload failed")
      setValue("passportUrl", pUrl)
      setValue("bankStatementUrl", bUrl)
      onNext({ passportUrl: pUrl, bankStatementUrl: bUrl })
    } catch {
      // error stays — submit won't fire
    } finally {
      setIsUploading?.(false)
    }
  }

  return (
    <form
      id="step-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold">Upload Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your identification and address proof documents.
        </p>
      </div>

      <div className="grid gap-4">
        {(
          Object.entries(docConfig) as [DocKey, (typeof docConfig)[DocKey]][]
        ).map(([key, config]) => (
          <DocUpload
            key={key}
            file={files[key]}
            onFileSelect={(f) => handleFileChange(key, f)}
            config={config}
            error={
              key === "passport"
                ? errors.passportUrl?.message
                : errors.bankStatementUrl?.message
            }
          />
        ))}
      </div>

      {alreadyUploaded && (
        <p className="text-sm text-green-600">
          Documents already uploaded. Click Next to continue.
        </p>
      )}
    </form>
  )
}

function DocUpload({
  file,
  onFileSelect,
  config,
  error,
}: {
  file: File | null
  onFileSelect: (file: File | null) => void
  config: { label: string; desc: string; icon: typeof IdCardIcon }
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const Icon = config.icon

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFileSelect(f)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10">
          <Icon className="size-5 text-sky-500" />
        </div>
        <div>
          <p className="text-sm font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.desc}</p>
        </div>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onFileSelect(null)}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed py-10 transition-colors ${
            dragging
              ? "border-sky-500 bg-sky-500/10"
              : "border-border hover:border-sky-500/50 hover:bg-sky-500/5"
          }`}
        >
          <UploadIcon className="size-7 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {dragging ? "Drop file here" : "Click or drag to upload"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PDF, PNG, JPG
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFileSelect(f)
          e.target.value = ""
        }}
      />

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
