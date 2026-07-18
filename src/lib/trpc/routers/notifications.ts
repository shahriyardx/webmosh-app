import { z } from "zod"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

export const notificationsRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(30),
        })
        .optional(),
    )
    .query(({ input }) =>
      prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 30,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          link: true,
          readAt: true,
          createdAt: true,
        },
      }),
    ),

  unreadCount: adminProcedure.query(() =>
    prisma.notification.count({ where: { readAt: null } }),
  ),

  markRead: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      prisma.notification.update({
        where: { id: input.id },
        data: { readAt: new Date() },
        select: { id: true, readAt: true },
      }),
    ),

  markAllRead: adminProcedure.mutation(async () => {
    const now = new Date()
    const result = await prisma.notification.updateMany({
      where: { readAt: null },
      data: { readAt: now },
    })
    return { count: result.count }
  }),

  clear: adminProcedure.mutation(() =>
    prisma.notification.deleteMany({}).then((r) => ({ count: r.count })),
  ),
})
