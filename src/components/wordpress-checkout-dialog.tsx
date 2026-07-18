"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CheckIcon, ExternalLinkIcon, PaletteIcon, SparklesIcon } from "lucide-react"

type Credentials = {
  cpanel: { url: string; username: string; password: string }
  wpAdmin: { url: string; username: string; password: string }
}

const EMPTY_CREDS: Credentials = {
  cpanel: { url: "", username: "", password: "" },
  wpAdmin: { url: "", username: "", password: "" },
}

type Contact = {
  company: string
  address: string
  email: string
  phone: string
}

const EMPTY_CONTACT: Contact = {
  company: "",
  address: "",
  email: "",
  phone: "",
}

export type WordpressPurchasePayload = {
  organizationId: string | null
  wordpress: {
    mode: "demo" | "custom"
    themeId?: string
    customDesignUrl?: string
    credentials: Credentials
    contact: Contact
  }
}

export function WordpressCheckoutDialog({
  open,
  onOpenChange,
  serviceTitle,
  servicePrice,
  loading,
  companies,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceTitle: string
  servicePrice: number
  loading: boolean
  companies?: { id: string; name: string }[]
  onSubmit: (payload: WordpressPurchasePayload) => void
}) {
  const { data: themes } = trpc.themes.list.useQuery(undefined, { enabled: open })

  const [mode, setMode] = useState<"demo" | "custom">("demo")
  const [themeId, setThemeId] = useState<string | null>(null)
  const [customDesignUrl, setCustomDesignUrl] = useState("")
  const [creds, setCreds] = useState<Credentials>(EMPTY_CREDS)
  const [organizationId, setOrganizationId] = useState<string>("")
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT)
  const [contactTouched, setContactTouched] = useState<
    Partial<Record<keyof Contact, boolean>>
  >({})

  const { data: profile } = trpc.companies.myProfile.useQuery(undefined, {
    enabled: open,
  })

  // Prefill from user's profile when the dialog opens.
  useEffect(() => {
    if (!open || !profile) return
    setContact((prev) => ({
      company: prev.company,
      address: prev.address || (profile.address ?? ""),
      email: prev.email || (profile.email ?? ""),
      phone: prev.phone || (profile.phone ?? ""),
    }))
  }, [open, profile])

  // Prefill company name from the chosen organization.
  useEffect(() => {
    if (!organizationId || !companies) {
      if (!contactTouched.company) {
        setContact((prev) => ({ ...prev, company: "" }))
      }
      return
    }
    const org = companies.find((c) => c.id === organizationId)
    if (org && !contactTouched.company) {
      setContact((prev) => ({ ...prev, company: org.name }))
    }
  }, [organizationId, companies, contactTouched.company])

  const hasAnyCred = useMemo(() => {
    return (
      !!creds.cpanel.url ||
      !!creds.cpanel.username ||
      !!creds.cpanel.password ||
      !!creds.wpAdmin.url ||
      !!creds.wpAdmin.username ||
      !!creds.wpAdmin.password
    )
  }, [creds])

  const handleSubmit = () => {
    if (mode === "demo" && !themeId) {
      toast.error("Please select a theme")
      return
    }
    if (mode === "custom" && !customDesignUrl.trim()) {
      toast.error("Please provide a design URL or Figma link")
      return
    }
    if (mode === "custom") {
      try {
        new URL(customDesignUrl.trim())
      } catch {
        toast.error("Design URL must be a valid link")
        return
      }
    }
    if (!hasAnyCred) {
      toast.error("Please provide cPanel or WP-admin access details")
      return
    }
    if (
      !contact.company.trim() ||
      !contact.address.trim() ||
      !contact.email.trim() ||
      !contact.phone.trim()
    ) {
      toast.error("Please fill in all customer details")
      return
    }
    try {
      new URL("mailto:" + contact.email.trim())
    } catch {
      // Not a real URL check — just a basic sanity pass. Full validation on server.
    }
    onSubmit({
      organizationId: organizationId || null,
      wordpress: {
        mode,
        themeId: mode === "demo" ? themeId! : undefined,
        customDesignUrl:
          mode === "custom" ? customDesignUrl.trim() : undefined,
        credentials: creds,
        contact: {
          company: contact.company.trim(),
          address: contact.address.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
        },
      },
    })
  }

  const updateContact = (patch: Partial<Contact>) => {
    setContact((prev) => ({ ...prev, ...patch }))
    setContactTouched((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.keys(patch).map((k) => [k, true])),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{serviceTitle}</DialogTitle>
          <DialogDescription>
            {mode === "demo" ? (
              <>
                Pick a pre-built theme, provide hosting access, and we'll get to
                work. Base price:{" "}
                <span className="font-semibold text-foreground">
                  ${servicePrice}
                </span>
                .
              </>
            ) : (
              <>
                Share your custom design, provide hosting access, and we'll send
                you a tailored quote before starting.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {companies && companies.length > 0 && (
            <Field>
              <FieldLabel>Attach to a company (optional)</FieldLabel>
              <FieldContent>
                <Select
                  value={organizationId || "none"}
                  onValueChange={(v) =>
                    setOrganizationId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      No company — personal order
                    </SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  WordPress is a universal service — pick a company only if you
                  want the order linked to one.
                </p>
              </FieldContent>
            </Field>
          )}

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-semibold">Website details</p>
              <p className="text-xs text-muted-foreground">
                {organizationId
                  ? "Prefilled from the selected company. Edit if needed."
                  : "Since you didn't pick a company, please share the contact details for this order."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel>Company name</FieldLabel>
                <FieldContent>
                  <Input
                    value={contact.company}
                    onChange={(e) =>
                      updateContact({ company: e.target.value })
                    }
                    placeholder="Acme Ltd."
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <FieldContent>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact({ email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <FieldContent>
                  <Input
                    value={contact.phone}
                    onChange={(e) => updateContact({ phone: e.target.value })}
                    placeholder="+1 555 555 5555"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Address</FieldLabel>
                <FieldContent>
                  <Textarea
                    value={contact.address}
                    onChange={(e) =>
                      updateContact({ address: e.target.value })
                    }
                    placeholder="Street, City, Country"
                    className="min-h-16"
                  />
                </FieldContent>
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("demo")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                mode === "demo"
                  ? "border-sky-500 bg-sky-500/5"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <PaletteIcon className="mt-0.5 size-5 shrink-0 text-sky-500" />
              <div>
                <p className="text-sm font-medium">Choose a demo</p>
                <p className="text-xs text-muted-foreground">
                  Pick from our pre-built designs. Fixed price.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                mode === "custom"
                  ? "border-sky-500 bg-sky-500/5"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <SparklesIcon className="mt-0.5 size-5 shrink-0 text-sky-500" />
              <div>
                <p className="text-sm font-medium">Custom design</p>
                <p className="text-xs text-muted-foreground">
                  Share a URL or Figma. We'll quote you back.
                </p>
              </div>
            </button>
          </div>

          {mode === "demo" ? (
            <div className="space-y-2">
              <FieldLabel>Available themes</FieldLabel>
              {!themes?.length ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No demo themes are available right now. Switch to Custom
                  design instead.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {themes.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={`overflow-hidden rounded-lg border text-left transition-all ${
                        themeId === t.id
                          ? "border-sky-500 ring-2 ring-sky-500/40"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="relative aspect-video bg-muted">
                        {t.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.image}
                            alt={t.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground/40">
                            <PaletteIcon className="size-8" />
                          </div>
                        )}
                        {themeId === t.id && (
                          <div className="absolute right-2 top-2 rounded-full bg-sky-500 p-1 text-white">
                            <CheckIcon className="size-3" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {t.description}
                        </p>
                        {t.demoUrl && (
                          <a
                            href={t.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline"
                          >
                            View demo
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Field>
              <FieldLabel>Design URL or Figma link</FieldLabel>
              <FieldContent>
                <Input
                  value={customDesignUrl}
                  onChange={(e) => setCustomDesignUrl(e.target.value)}
                  placeholder="https://www.figma.com/… or https://…"
                />
                <p className="text-xs text-muted-foreground">
                  Share a link to the design you'd like us to build. We'll
                  review it and send you a quote.
                </p>
              </FieldContent>
            </Field>
          )}

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-semibold">Hosting access</p>
              <p className="text-xs text-muted-foreground">
                Provide either cPanel or WP-admin credentials so our team can
                deploy your site.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                cPanel access
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  placeholder="cPanel URL"
                  value={creds.cpanel.url}
                  onChange={(e) =>
                    setCreds({
                      ...creds,
                      cpanel: { ...creds.cpanel, url: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="Username"
                  value={creds.cpanel.username}
                  onChange={(e) =>
                    setCreds({
                      ...creds,
                      cpanel: { ...creds.cpanel, username: e.target.value },
                    })
                  }
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={creds.cpanel.password}
                  onChange={(e) =>
                    setCreds({
                      ...creds,
                      cpanel: { ...creds.cpanel, password: e.target.value },
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                WP-admin access
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  placeholder="wp-admin URL"
                  value={creds.wpAdmin.url}
                  onChange={(e) =>
                    setCreds({
                      ...creds,
                      wpAdmin: { ...creds.wpAdmin, url: e.target.value },
                    })
                  }
                />
                <Input
                  placeholder="Username"
                  value={creds.wpAdmin.username}
                  onChange={(e) =>
                    setCreds({
                      ...creds,
                      wpAdmin: {
                        ...creds.wpAdmin,
                        username: e.target.value,
                      },
                    })
                  }
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={creds.wpAdmin.password}
                  onChange={(e) =>
                    setCreds({
                      ...creds,
                      wpAdmin: {
                        ...creds.wpAdmin,
                        password: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? "Processing…"
              : mode === "demo"
              ? `Purchase — $${servicePrice}`
              : "Submit for quote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
