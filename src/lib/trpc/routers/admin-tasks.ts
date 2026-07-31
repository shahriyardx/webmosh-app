import { z } from "zod"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

const PRIORITIES = ["low", "medium", "high"] as const

export const adminTasksRouter = router({
  /** Manual admin to-do list — open tasks first, then by due date. */
  list: adminProcedure.query(() =>
    prisma.adminTask.findMany({
      orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
  ),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        note: z.string().max(2000).optional(),
        priority: z.enum(PRIORITIES).default("medium"),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      prisma.adminTask.create({
        data: {
          title: input.title.trim(),
          note: input.note?.trim() || null,
          priority: input.priority,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          createdById: ctx.user.id,
        },
      }),
    ),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        note: z.string().max(2000).nullable().optional(),
        priority: z.enum(PRIORITIES).optional(),
        dueDate: z.string().nullable().optional(),
        done: z.boolean().optional(),
      }),
    )
    .mutation(({ input }) => {
      const { id, note, dueDate, ...rest } = input
      return prisma.adminTask.update({
        where: { id },
        data: {
          ...rest,
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(note !== undefined ? { note: note?.trim() || null } : {}),
          ...(dueDate !== undefined
            ? { dueDate: dueDate ? new Date(dueDate) : null }
            : {}),
        },
      })
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      prisma.adminTask.delete({ where: { id: input.id } }),
    ),
})
