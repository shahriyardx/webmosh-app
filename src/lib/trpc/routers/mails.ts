import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { emailUserNewMail } from "@/lib/notify"

export const mailsRouter = router({
  create: adminProcedure
    .input(
      z.object({
        organizationId: z.string(),
        from: z.string().min(1),
        subject: z.string().min(1),
        body: z.string().min(1),
        attachments: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const mail = await prisma.mail.create({
        data: {
          organizationId: input.organizationId,
          from: input.from,
          subject: input.subject,
          body: input.body,
          attachments: input.attachments,
        },
      })
      await emailUserNewMail(input.organizationId, input.subject).catch(() => {})
      return mail
    }),

  listByOrg: adminProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      return prisma.mail.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "desc" },
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session?.session?.activeOrganizationId
    if (!orgId) return []
    return prisma.mail.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    })
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session?.session?.activeOrganizationId
    if (!orgId) return 0
    return prisma.mail.count({
      where: { organizationId: orgId, read: false },
    })
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const mail = await prisma.mail.findUnique({ where: { id: input.id } })
      if (!mail || mail.organizationId !== orgId) {
        throw new Error("Mail not found")
      }
      return prisma.mail.update({
        where: { id: input.id },
        data: { read: true },
      })
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.mail.delete({ where: { id: input.id } })
    }),
})
