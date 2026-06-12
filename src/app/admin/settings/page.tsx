"use client"

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

const schema = z.object({
  usdToBdtRate: z.string(),
  bkashNumber: z.string(),
  stripePublishableKey: z.string(),
  stripeSecretKey: z.string(),
})

type Schema = z.infer<typeof schema>

export default function AdminSettingsPage() {
  const utils = trpc.useUtils()
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery()
  const update = trpc.settings.update.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
  })

  const { control, handleSubmit, reset } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { usdToBdtRate: "", bkashNumber: "", stripePublishableKey: "", stripeSecretKey: "" },
  })

  useEffect(() => {
    if (settings) {
      reset({
        usdToBdtRate: settings.usd_to_bdt_rate ?? "",
        bkashNumber: settings.bkash_number ?? "",
        stripePublishableKey: settings.stripe_publishable_key ?? "",
        stripeSecretKey: settings.stripe_secret_key ?? "",
      })
    }
  }, [settings, reset])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
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

          <Controller
            control={control}
            name="bkashNumber"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>bKash Number</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="e.g. 01XXXXXXXXX"
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <div className="border-t border-border pt-5">
            <span className="text-sm font-semibold">Stripe</span>
          </div>

          <Controller
            control={control}
            name="stripePublishableKey"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Publishable Key</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="pk_live_..."
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldContent>
              </Field>
            )}
          />

          <Controller
            control={control}
            name="stripeSecretKey"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Secret Key</FieldLabel>
                <FieldContent>
                  <Input
                    type="password"
                    placeholder="sk_live_..."
                    {...field}
                  />
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
