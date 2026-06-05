import { z } from "zod"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

const packageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  country: z.enum(["us", "uk"]),
  features: z.array(z.string().min(1)).min(1, "At least one feature required"),
  price: z.number().int().min(0, "Price must be non-negative"),
})

export const packagesRouter = router({
  list: adminProcedure.query(() =>
    prisma.package.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  create: adminProcedure.input(packageSchema).mutation(({ input }) =>
    prisma.package.create({ data: input }),
  ),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(packageSchema.partial()))
    .mutation(({ input }) =>
      prisma.package.update({ where: { id: input.id }, data: input }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      prisma.package.delete({ where: { id: input.id } }),
    ),
})
