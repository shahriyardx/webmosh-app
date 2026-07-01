import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

export const settingsRouter = router({
  getAll: protectedProcedure.query(async () => {
    const rows = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.key] = row.value
    }
    return map
  }),

  update: adminProcedure
    .input(
      z.object({
        usdToBdtRate: z.string().optional().default(""),
        bkashNumber: z.string().optional().default(""),
        stripePublishableKey: z.string().optional().default(""),
        stripeSecretKey: z.string().optional().default(""),
        invoiceFromName: z.string().optional(),
        invoiceFromAddress: z.string().optional(),
        invoiceFromPhone: z.string().optional(),
        invoiceFromEmail: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Skipped when empty (avoid wiping secrets/rate)
      const guarded = [
        { key: "usd_to_bdt_rate", value: input.usdToBdtRate },
        { key: "bkash_number", value: input.bkashNumber },
        { key: "stripe_publishable_key", value: input.stripePublishableKey },
        { key: "stripe_secret_key", value: input.stripeSecretKey },
      ]
      for (const { key, value } of guarded) {
        if (!value) continue
        await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
      }

      // Always upserted (empty allowed) when provided
      const invoiceFields: [string, string | undefined][] = [
        ["invoice_from_name", input.invoiceFromName],
        ["invoice_from_address", input.invoiceFromAddress],
        ["invoice_from_phone", input.invoiceFromPhone],
        ["invoice_from_email", input.invoiceFromEmail],
      ]
      for (const [key, value] of invoiceFields) {
        if (value === undefined) continue
        await prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      }
    }),
})
