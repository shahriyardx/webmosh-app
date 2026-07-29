"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SparklesIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
} from "lucide-react"

export function AiAgentSettings() {
  const utils = trpc.useUtils()
  const { data: status, isLoading } = trpc.aiAgent.keyStatus.useQuery()

  const [apiKey, setApiKey] = useState("")
  const [show, setShow] = useState(false)
  const [testResult, setTestResult] = useState<
    { ok: boolean; error?: string } | null
  >(null)

  const setKey = trpc.aiAgent.setKey.useMutation({
    onSuccess: () => {
      utils.aiAgent.keyStatus.invalidate()
      setApiKey("")
      setTestResult(null)
      toast.success("Anthropic API key saved")
    },
    onError: (e) => toast.error(e.message),
  })
  const clearKey = trpc.aiAgent.clearKey.useMutation({
    onSuccess: () => {
      utils.aiAgent.keyStatus.invalidate()
      setTestResult(null)
      toast.success("API key removed")
    },
    onError: (e) => toast.error(e.message),
  })
  const testKey = trpc.aiAgent.testKey.useMutation({
    onSuccess: (r) => {
      setTestResult(r)
      if (r.ok) toast.success("Anthropic connection OK")
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: modelData } = trpc.aiAgent.model.useQuery()
  const setModel = trpc.aiAgent.setModel.useMutation({
    onSuccess: () => {
      utils.aiAgent.model.invalidate()
      toast.success("Model updated")
    },
    onError: (e) => toast.error(e.message),
  })

  const configured = status?.configured
  const preview = status?.preview

  const save = () => {
    const key = apiKey.trim()
    if (!key) return
    if (
      configured &&
      !window.confirm("This will overwrite the existing API key. Continue?")
    ) {
      return
    }
    setKey.mutate({ apiKey: key })
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <SparklesIcon className="size-4 text-sky-500" />
        <span className="text-sm font-semibold">AI Agent</span>
      </div>
      <div className="space-y-5 px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Connect an Anthropic (Claude) API key to enable the AI Agent chat and
          document extraction. The key is encrypted at rest and never shown again
          in full.
        </p>

        {/* Current status */}
        {isLoading ? (
          <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        ) : configured ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
            <CheckCircle2Icon className="size-4 text-emerald-500" />
            <span className="text-sm font-medium">API key configured</span>
            {preview && (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {preview}
              </code>
            )}
            {status?.source === "env" && (
              <span className="text-xs text-muted-foreground">
                (from server env)
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
            <XCircleIcon className="size-4 text-amber-500" />
            <span className="text-sm font-medium">No API key set</span>
          </div>
        )}

        {/* Key input */}
        <Field>
          <FieldLabel>
            {configured ? "Replace API key" : "Anthropic API key"}
          </FieldLabel>
          <FieldContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={show ? "text" : "password"}
                  placeholder="sk-ant-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-9"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Hide" : "Show"}
                >
                  {show ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              <Button onClick={save} disabled={!apiKey.trim() || setKey.isPending}>
                {setKey.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </FieldContent>
        </Field>

        {/* Test / remove */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTestResult(null)
              testKey.mutate()
            }}
            disabled={!configured || testKey.isPending}
          >
            {testKey.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="size-3.5" />
            )}
            Test connection
          </Button>
          {configured && status?.source === "database" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (window.confirm("Remove the stored Anthropic API key?")) {
                  clearKey.mutate()
                }
              }}
              disabled={clearKey.isPending}
            >
              Remove key
            </Button>
          )}
          {testResult && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                testResult.ok ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2Icon className="size-3.5" />
              ) : (
                <XCircleIcon className="size-3.5" />
              )}
              {testResult.ok ? "Connection OK" : testResult.error}
            </span>
          )}
        </div>

        {/* Model selector */}
        <div className="border-t border-border pt-4">
          <Field>
            <FieldLabel>Model</FieldLabel>
            <FieldContent>
              <Select
                value={modelData?.model}
                onValueChange={(v) => setModel.mutate({ model: v })}
                disabled={!modelData || setModel.isPending}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelData?.options.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.hint}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The model the AI Agent uses for chat commands and document
                extraction.
              </p>
            </FieldContent>
          </Field>
        </div>
      </div>
    </div>
  )
}
