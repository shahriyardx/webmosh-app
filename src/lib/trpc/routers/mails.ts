import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
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

  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      return prisma.mail.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "desc" },
      })
    }),

  unreadCount: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      return prisma.mail.count({
        where: { organizationId: input.organizationId, read: false },
      })
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const mail = await prisma.mail.findUnique({ where: { id: input.id } })
      if (!mail) throw new Error("Mail not found")
      await assertOrgMember(ctx.user.id, mail.organizationId)
      return prisma.mail.update({
        where: { id: input.id },
        data: { read: true },
      })
    }),

  listForUser: protectedProcedure.query(async ({ ctx }) => {
    const members = await prisma.member.findMany({
      where: { userId: ctx.user.id, organization: { deletedAt: null } },
      select: { organizationId: true },
    })
    const orgIds = members.map((m) => m.organizationId)
    if (!orgIds.length) return []
    const [mails, orgs] = await Promise.all([
      prisma.mail.findMany({
        where: { organizationId: { in: orgIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      }),
    ])
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    return mails.map((m) => ({ ...m, organization: orgMap.get(m.organizationId) ?? null }))
  }),

  unreadCountForUser: protectedProcedure.query(async ({ ctx }) => {
    const members = await prisma.member.findMany({
      where: { userId: ctx.user.id, organization: { deletedAt: null } },
      select: { organizationId: true },
    })
    const orgIds = members.map((m) => m.organizationId)
    if (!orgIds.length) return 0
    return prisma.mail.count({
      where: { organizationId: { in: orgIds }, read: false },
    })
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.mail.delete({ where: { id: input.id } })
    }),
})
