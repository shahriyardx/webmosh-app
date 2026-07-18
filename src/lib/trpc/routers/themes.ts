import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

const themeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  image: z.string().url().optional().or(z.literal("")),
  demoUrl: z.string().url().optional().or(z.literal("")),
})

export const themesRouter = router({
  list: protectedProcedure.query(() =>
    prisma.theme.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => prisma.theme.findUnique({ where: { id: input.id } })),

  create: adminProcedure.input(themeSchema).mutation(({ input }) =>
    prisma.theme.create({
      data: {
        title: input.title,
        description: input.description,
        image: input.image || null,
        demoUrl: input.demoUrl || null,
      },
    }),
  ),

  update: adminProcedure
    .input(z.object({ id: z.string() }).merge(themeSchema.partial()))
    .mutation(({ input }) => {
      const { id, image, demoUrl, ...rest } = input
      return prisma.theme.update({
        where: { id },
        data: {
          ...rest,
          ...(image !== undefined ? { image: image || null } : {}),
          ...(demoUrl !== undefined ? { demoUrl: demoUrl || null } : {}),
        },
      })
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => prisma.theme.delete({ where: { id: input.id } })),
})
