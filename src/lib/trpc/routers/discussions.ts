import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  adminOrFreelancerProcedure,
  adminProcedure,
  freelancerProcedure,
  router,
} from "../server"
import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/notifications"

/**
 * A "discussion" is the message thread attached to a Task. The two
 * participants are always the same: the assigned freelancer and the admin
 * team. There is no separate thread row — the Task is the thread, and
 * TaskMessage rows are the messages. Read state is tracked per side with
 * two booleans so both the admin and the freelancer get unread badges.
 */

const threadTaskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  organization: { select: { id: true, name: true } },
  order: { select: { id: true, service: { select: { title: true } } } },
} as const

/** Confirm the current user may see/participate in a task's discussion. */
async function authorizeTask(
  taskId: string,
  user: { id: string; role?: string | null },
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assignedToId: true },
  })
  if (!task) throw new TRPCError({ code: "NOT_FOUND" })
  if (user.role === "freelancer" && task.assignedToId !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return task
}

export const discussionsRouter = router({
  /**
   * Freelancer: every task assigned to me, annotated with the last message
   * and my unread count, most-recently-active first. Tasks with no messages
   * yet are included (sorted last) so a chat can be started on any of them.
   */
  myThreads: freelancerProcedure.query(async ({ ctx }) => {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: ctx.user.id },
      select: {
        ...threadTaskSelect,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, fromAdmin: true, createdAt: true },
        },
        _count: {
          select: {
            messages: { where: { fromAdmin: true, readByFreelancer: false } },
          },
        },
      },
    })
    return tasks
      .map((t) => ({
        ...t,
        lastMessage: t.messages[0] ?? null,
        unread: t._count.messages,
      }))
      .sort((a, b) => {
        const at = a.lastMessage?.createdAt?.getTime() ?? 0
        const bt = b.lastMessage?.createdAt?.getTime() ?? 0
        return bt - at
      })
  }),

  /**
   * Admin: every task that has at least one message, annotated with the last
   * message and the admin-side unread count.
   */
  allThreads: adminProcedure.query(async () => {
    const tasks = await prisma.task.findMany({
      where: { messages: { some: {} } },
      select: {
        ...threadTaskSelect,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, fromAdmin: true, createdAt: true },
        },
        _count: {
          select: {
            messages: { where: { fromAdmin: false, readByAdmin: false } },
          },
        },
      },
    })
    return tasks
      .map((t) => ({
        ...t,
        lastMessage: t.messages[0] ?? null,
        unread: t._count.messages,
      }))
      .sort((a, b) => {
        const at = a.lastMessage?.createdAt?.getTime() ?? 0
        const bt = b.lastMessage?.createdAt?.getTime() ?? 0
        return bt - at
      })
  }),

  /** Total unread messages for the current user's side (sidebar badge). */
  unreadCount: adminOrFreelancerProcedure.query(({ ctx }) => {
    if (ctx.user.role === "admin") {
      return prisma.taskMessage.count({
        where: { fromAdmin: false, readByAdmin: false },
      })
    }
    return prisma.taskMessage.count({
      where: {
        fromAdmin: true,
        readByFreelancer: false,
        task: { assignedToId: ctx.user.id },
      },
    })
  }),

  /** The task header + full message list for one discussion. */
  getThread: adminOrFreelancerProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input, ctx }) => {
      await authorizeTask(input.taskId, ctx.user)
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        select: {
          ...threadTaskSelect,
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              body: true,
              attachments: true,
              fromAdmin: true,
              createdAt: true,
              sender: { select: { id: true, name: true, image: true } },
            },
          },
        },
      })
      return task
    }),

  send: adminOrFreelancerProcedure
    .input(
      z.object({
        taskId: z.string(),
        body: z.string().min(1),
        attachments: z.array(z.string()).max(5).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const task = await authorizeTask(input.taskId, ctx.user)
      const fromAdmin = ctx.user.role === "admin"
      const message = await prisma.taskMessage.create({
        data: {
          taskId: input.taskId,
          senderId: ctx.user.id,
          fromAdmin,
          body: input.body.trim(),
          attachments: input.attachments,
          // The sender has, by definition, read their own message.
          readByAdmin: fromAdmin,
          readByFreelancer: !fromAdmin,
        },
      })
      // Touch the task so thread ordering by activity stays fresh.
      await prisma.task.update({
        where: { id: input.taskId },
        data: { updatedAt: new Date() },
      })
      if (!fromAdmin) {
        const detail = await prisma.task.findUnique({
          where: { id: input.taskId },
          select: { title: true },
        })
        await createAdminNotification({
          kind: "discussion.message",
          title: `New message from ${ctx.user.name ?? ctx.user.email}`,
          body: `On task "${detail?.title ?? "task"}": ${input.body.slice(0, 80)}`,
          link: `/admin/discussions?task=${input.taskId}`,
        })
      }
      return message
    }),

  /** Mark the other side's messages in a thread as read for the current side. */
  markRead: adminOrFreelancerProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await authorizeTask(input.taskId, ctx.user)
      if (ctx.user.role === "admin") {
        await prisma.taskMessage.updateMany({
          where: { taskId: input.taskId, fromAdmin: false, readByAdmin: false },
          data: { readByAdmin: true },
        })
      } else {
        await prisma.taskMessage.updateMany({
          where: {
            taskId: input.taskId,
            fromAdmin: true,
            readByFreelancer: false,
          },
          data: { readByFreelancer: true },
        })
      }
      return { ok: true }
    }),
})
