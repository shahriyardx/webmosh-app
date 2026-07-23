"use client"

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

const schema = z.object({
  usdToBdtRate: z.string(),
  invoiceFromName: z.string(),
  invoiceFromAddress: z.string(),
  invoiceFromPhone: z.string(),
  invoiceFromEmail: z.string(),
})

type Schema = z.infer<typeof schema>

export default function AdminSettingsPage() {
  const utils = trpc.useUtils()
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery()
  const update = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate()
      toast.success("Settings saved")
    },
  })

  const { control, handleSubmit, reset } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      usdToBdtRate: "",
      invoiceFromName: "",
      invoiceFromAddress: "",
      invoiceFromPhone: "",
      invoiceFromEmail: "",
    },
  })

  useEffect(() => {
    if (settings) {
      reset({
        usdToBdtRate: settings.usd_to_bdt_rate ?? "",
        invoiceFromName: settings.invoice_from_name ?? "",
        invoiceFromAddress: settings.invoice_from_address ?? "",
        invoiceFromPhone: settings.invoice_from_phone ?? "",
        invoiceFromEmail: settings.invoice_from_email ?? "",
      })
    }
  }, [settings, reset])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure payment and exchange rate settings.
        </p>
      </div>

      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-5 py-3.5">
          <span className="text-sm font-semibold">Payment Settings</span>
        </div>
        <form
          onSubmit={handleSubmit((data) => update.mutate(data))}
          className="space-y-5 px-5 py-4"
        >
          <Controller
            control={control}
            name="usdToBdtRate"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>USD to BDT Rate</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 120"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <div className="border-t border-border pt-5">
            <span className="text-sm font-semibold">Invoice Details (FROM)</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shown as the sender on downloadable invoices.
            </p>
          </div>

          <Controller
            control={control}
            name="invoiceFromName"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Company Name</FieldLabel>
                <FieldContent>
                  <Input placeholder="e.g. WEBMOSH" {...field} />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Controller
            control={control}
            name="invoiceFromPhone"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Phone Number</FieldLabel>
                <FieldContent>
                  <Input placeholder="e.g. +8801XXXXXXXXX" {...field} />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Controller
            control={control}
            name="invoiceFromEmail"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Email</FieldLabel>
                <FieldContent>
                  <Input placeholder="e.g. info@webmosh.com" {...field} />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Controller
            control={control}
            name="invoiceFromAddress"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Address</FieldLabel>
                <FieldContent>
                  <Textarea rows={2} placeholder="Street, City, Postcode, Country" {...field} />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </form>
      </div>
    </div>
  )
}
