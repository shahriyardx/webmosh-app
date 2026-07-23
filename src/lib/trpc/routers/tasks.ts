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
import {
  emailFreelancerTaskAssigned,
  emailAdminTaskSubmitted,
} from "@/lib/notify"
import { PayoutStatus, TaskPriority, TaskStatus } from "@/generated/prisma/enums"

const priorityEnum = z.nativeEnum(TaskPriority)
const statusEnum = z.nativeEnum(TaskStatus)

const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  priority: priorityEnum.default(TaskPriority.medium),
  status: statusEnum.default(TaskStatus.todo),
  deadline: z.date().nullable().optional(),
  payoutAmount: z.number().min(0).nullable().optional(),
  assignedToId: z.string(),
  organizationId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
})

const taskUpdateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: priorityEnum.optional(),
  status: statusEnum.optional(),
  deadline: z.date().nullable().optional(),
  payoutAmount: z.number().min(0).nullable().optional(),
  assignedToId: z.string().optional(),
  organizationId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
})

/**
 * Selector for task fields safe to expose to the assigned freelancer.
 * Client info is limited: linked company name, service title, chosen theme
 * name / custom design URL, and the credentials the customer submitted (so
 * the freelancer can actually do the work).
 */
const taskSelect = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  deadline: true,
  payoutAmount: true,
  assignedToId: true,
  createdById: true,
  organizationId: true,
  orderId: true,
  revisionNote: true,
  submittedAt: true,
  deliveryNote: true,
  deliveryNoteIncluded: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: {
    select: { id: true, name: true, email: true, image: true },
  },
  organization: {
    select: { id: true, name: true, country: true },
  },
  order: {
    select: {
      id: true,
      status: true,
      customDesignUrl: true,
      credentials: true,
      contactCompany: true,
      contactAddress: true,
      contactEmail: true,
      contactPhone: true,
      theme: { select: { id: true, title: true, image: true, demoUrl: true } },
      service: { select: { id: true, title: true } },
    },
  },
} as const

export const tasksRouter = router({
  /**
   * Admin: WordPress service orders in the assignment queue.
   * Every order with a WordPress-type service, joined with its first task
   * (if any) so we can show who — if anyone — is on it.
   */
  wordpressOrdersQueue: adminProcedure.query(async () => {
    const orders = await prisma.serviceOrder.findMany({
      where: { service: { type: "wordpress" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        customDesignUrl: true,
        createdAt: true,
        service: { select: { id: true, title: true } },
        organization: { select: { id: true, name: true, country: true } },
        theme: { select: { id: true, title: true } },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            assignedTo: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      customDesignUrl: o.customDesignUrl,
      createdAt: o.createdAt,
      service: o.service,
      organization: o.organization,
      theme: o.theme,
      task: o.tasks[0] ?? null,
    }))
  }),

  /** Admin: every task in the system. */
  listAll: adminProcedure
    .input(
      z
        .object({
          assignedToId: z.string().optional(),
          status: statusEnum.optional(),
        })
        .optional(),
    )
    .query(({ input }) =>
      prisma.task.findMany({
        where: {
          ...(input?.assignedToId ? { assignedToId: input.assignedToId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
        select: taskSelect,
      }),
    ),

  /** Freelancer: tasks assigned to me. */
  listMine: freelancerProcedure.query(({ ctx }) =>
    prisma.task.findMany({
      where: { assignedToId: ctx.user.id },
      orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
      select: taskSelect,
    }),
  ),

  /**
   * Freelancer balance — sum of payoutAmount for done tasks minus what has
   * already been approved or requested via payouts. Also returns the pipeline
   * (payoutAmount for open tasks) so the dashboard can show a proper split.
   */
  myBalance: freelancerProcedure.query(async ({ ctx }) => {
    const [
      earnedAgg,
      pipelineAgg,
      approvedPayoutAgg,
      pendingPayoutAgg,
      adjustmentAgg,
      doneCount,
    ] = await Promise.all([
      prisma.task.aggregate({
        where: { assignedToId: ctx.user.id, status: TaskStatus.done },
        _sum: { payoutAmount: true },
      }),
      prisma.task.aggregate({
        where: {
          assignedToId: ctx.user.id,
          status: { not: TaskStatus.done },
        },
        _sum: { payoutAmount: true },
      }),
      prisma.payout.aggregate({
        where: {
          freelancerId: ctx.user.id,
          status: PayoutStatus.approved,
        },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: {
          freelancerId: ctx.user.id,
          status: PayoutStatus.pending,
        },
        _sum: { amount: true },
      }),
      prisma.freelancerAdjustment.aggregate({
        where: { freelancerId: ctx.user.id },
        _sum: { amount: true },
      }),
      prisma.task.count({
        where: { assignedToId: ctx.user.id, status: TaskStatus.done },
      }),
    ])
    const earned = earnedAgg._sum.payoutAmount ?? 0
    const pipeline = pipelineAgg._sum.payoutAmount ?? 0
    const paidOut = approvedPayoutAgg._sum.amount ?? 0
    const requested = pendingPayoutAgg._sum.amount ?? 0
    const adjustments = adjustmentAgg._sum.amount ?? 0
    const available = Math.max(0, earned + adjustments - paidOut - requested)
    return {
      earned,
      pending: pipeline,
      paidOut,
      requested,
      available,
      doneCount,
    }
  }),

  /** Freelancer summary stats for the dashboard. */
  myStats: freelancerProcedure.query(async ({ ctx }) => {
    const rows = await prisma.task.groupBy({
      by: ["status"],
      where: { assignedToId: ctx.user.id },
      _count: { _all: true },
    })
    const counts = {
      todo: 0,
      in_progress: 0,
      in_review: 0,
      blocked: 0,
      done: 0,
    } as Record<TaskStatus, number>
    for (const row of rows) {
      counts[row.status] = row._count._all
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return { ...counts, total }
  }),

  /** Admin or the assigned freelancer can fetch a task. */
  getById: adminOrFreelancerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: taskSelect,
      })
      if (!task) return null
      if (ctx.user.role === "freelancer" && task.assignedToId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }
      return task
    }),

  create: adminProcedure
    .input(taskCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assignedToId, role: "freelancer" },
        select: { id: true },
      })
      if (!assignee) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assignee must be a freelancer.",
        })
      }
      const task = await prisma.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: input.status,
          deadline: input.deadline ?? null,
          payoutAmount: input.payoutAmount ?? null,
          assignedToId: input.assignedToId,
          createdById: ctx.user.id,
          organizationId: input.organizationId ?? null,
          orderId: input.orderId ?? null,
        },
        select: taskSelect,
      })

      if (task.assignedTo?.email) {
        await emailFreelancerTaskAssigned(
          task.assignedTo.email,
          task.assignedTo.name,
          {
            taskId: task.id,
            taskTitle: task.title,
            priority: task.priority,
            deadline: task.deadline,
          },
        ).catch(() => {})
      }

      return task
    }),

  update: adminProcedure
    .input(taskUpdateSchema)
    .mutation(async ({ input }) => {
      const { id, ...rest } = input
      let previousAssignee: string | null = null
      if (rest.assignedToId) {
        const assignee = await prisma.user.findFirst({
          where: { id: rest.assignedToId, role: "freelancer" },
          select: { id: true },
        })
        if (!assignee) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee must be a freelancer.",
          })
        }
        const existing = await prisma.task.findUnique({
          where: { id },
          select: { assignedToId: true },
        })
        previousAssignee = existing?.assignedToId ?? null
      }

      const task = await prisma.task.update({
        where: { id },
        data: rest,
        select: taskSelect,
      })

      // Notify the freelancer only when the task is (re)assigned to them.
      if (
        rest.assignedToId &&
        rest.assignedToId !== previousAssignee &&
        task.assignedTo?.email
      ) {
        await emailFreelancerTaskAssigned(
          task.assignedTo.email,
          task.assignedTo.name,
          {
            taskId: task.id,
            taskTitle: task.title,
            priority: task.priority,
            deadline: task.deadline,
          },
        ).catch(() => {})
      }

      return task
    }),

  /**
   * Admin: change any task's status directly.
   * Freelancer: only move between working states (todo / in_progress /
   * blocked) on their own tasks. To finish a task they submit it for
   * approval (`submitForReview`) — they can't set `done` themselves.
   */
  updateStatus: adminOrFreelancerProcedure
    .input(z.object({ id: z.string(), status: statusEnum }))
    .mutation(async ({ input, ctx }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { assignedToId: true },
      })
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (ctx.user.role === "freelancer") {
        if (task.assignedToId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" })
        }
        const allowed: TaskStatus[] = [
          TaskStatus.todo,
          TaskStatus.in_progress,
          TaskStatus.blocked,
        ]
        if (!allowed.includes(input.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Submit the task for approval to mark it done.",
          })
        }
      }
      return prisma.task.update({
        where: { id: input.id },
        data: { status: input.status },
        select: taskSelect,
      })
    }),

  /**
   * Freelancer: submit their task for admin approval. Moves it to
   * `in_review` and notifies the admin. Payment is only credited once the
   * admin approves.
   */
  /** Freelancer: save the private delivery note (notepad) on their own task. */
  saveDeliveryNote: freelancerProcedure
    .input(
      z.object({
        id: z.string(),
        note: z.string(),
        included: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { assignedToId: true },
      })
      if (!task || task.assignedToId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      return prisma.task.update({
        where: { id: input.id },
        data: {
          deliveryNote: input.note.trim() || null,
          ...(input.included !== undefined
            ? { deliveryNoteIncluded: input.included }
            : {}),
        },
        select: taskSelect,
      })
    }),

  submitForReview: freelancerProcedure
    .input(
      z.object({
        id: z.string(),
        includeNote: z.boolean().optional(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { assignedToId: true, status: true, title: true },
      })
      if (!task || task.assignedToId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (task.status === TaskStatus.done) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This task is already approved.",
        })
      }
      if (task.status === TaskStatus.in_review) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This task is already awaiting approval.",
        })
      }
      const updated = await prisma.task.update({
        where: { id: input.id },
        data: {
          status: TaskStatus.in_review,
          submittedAt: new Date(),
          ...(input.includeNote !== undefined
            ? { deliveryNoteIncluded: input.includeNote }
            : {}),
          ...(input.note !== undefined
            ? { deliveryNote: input.note.trim() || null }
            : {}),
        },
        select: taskSelect,
      })
      await createAdminNotification({
        kind: "task.submitted",
        title: `Task ready for review: ${task.title}`,
        body: `${ctx.user.name ?? ctx.user.email} submitted a task for approval.`,
        link: `/admin/tasks/${input.id}`,
      })
      await emailAdminTaskSubmitted(
        ctx.user.name ?? ctx.user.email,
        input.id,
        task.title,
      ).catch(() => {})
      return updated
    }),

  /** Admin: every task awaiting approval (freelancer submitted). */
  pendingApprovals: adminProcedure.query(() =>
    prisma.task.findMany({
      where: { status: TaskStatus.in_review },
      orderBy: { submittedAt: "asc" },
      select: taskSelect,
    }),
  ),

  /** Admin: count of tasks awaiting approval (sidebar badge). */
  pendingApprovalCount: adminProcedure.query(() =>
    prisma.task.count({ where: { status: TaskStatus.in_review } }),
  ),

  /**
   * Admin: approve a submitted task. Moves it to `done`, which credits the
   * freelancer's balance (balance counts done tasks), and clears any prior
   * revision note.
   */
  approveTask: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!task) throw new TRPCError({ code: "NOT_FOUND" })
      if (task.status !== TaskStatus.in_review) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only tasks awaiting approval can be approved.",
        })
      }
      return prisma.task.update({
        where: { id: input.id },
        data: { status: TaskStatus.done, revisionNote: null },
        select: taskSelect,
      })
    }),

  /**
   * Admin: send a submitted task back for revision with a note. Moves it to
   * `in_progress` so the freelancer can fix and resubmit.
   */
  requestRevision: adminProcedure
    .input(z.object({ id: z.string(), note: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!task) throw new TRPCError({ code: "NOT_FOUND" })
      if (task.status !== TaskStatus.in_review) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only tasks awaiting approval can be sent for revision.",
        })
      }
      return prisma.task.update({
        where: { id: input.id },
        data: {
          status: TaskStatus.in_progress,
          revisionNote: input.note.trim(),
        },
        select: taskSelect,
      })
    }),

  /**
   * Admin: reject a submitted task. Moves it to `blocked` with a reason so the
   * freelancer knows it wasn't accepted (no payment is released).
   */
  rejectTask: adminProcedure
    .input(z.object({ id: z.string(), note: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!task) throw new TRPCError({ code: "NOT_FOUND" })
      if (task.status !== TaskStatus.in_review) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only tasks awaiting approval can be rejected.",
        })
      }
      return prisma.task.update({
        where: { id: input.id },
        data: {
          status: TaskStatus.blocked,
          revisionNote: input.note.trim(),
        },
        select: taskSelect,
      })
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.task.delete({ where: { id: input.id } })
      return { ok: true }
    }),
})
