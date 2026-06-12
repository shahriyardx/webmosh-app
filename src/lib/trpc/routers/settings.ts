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
      }),
    )
    .mutation(async ({ input }) => {
      const upserts = [
        { key: "usd_to_bdt_rate", value: input.usdToBdtRate },
        { key: "bkash_number", value: input.bkashNumber },
        { key: "stripe_publishable_key", value: input.stripePublishableKey },
        { key: "stripe_secret_key", value: input.stripeSecretKey },
      ]
      for (const { key, value } of upserts) {
        if (!value) continue
        await prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        })
      }
    }),
})
