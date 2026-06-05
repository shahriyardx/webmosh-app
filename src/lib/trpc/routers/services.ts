import { z } from "zod"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

const serviceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  features: z.array(z.string()).min(1, "At least one feature required"),
  price: z.number().min(0, "Price must be non-negative"),
  country: z.enum(["us", "uk"]),
})

export const servicesRouter = router({
  list: adminProcedure.query(() =>
    prisma.service.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => prisma.service.findUnique({ where: { id: input.id } })),

  create: adminProcedure.input(serviceSchema).mutation(({ input }) =>
    prisma.service.create({ data: input }),
  ),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(serviceSchema.partial()))
    .mutation(({ input }) =>
      prisma.service.update({ where: { id: input.id }, data: input }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => prisma.service.delete({ where: { id: input.id } })),
})
