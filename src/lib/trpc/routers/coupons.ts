import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  adminProcedure,
  assertOrgMember,
  protectedProcedure,
  router,
} from "../server"
import { prisma } from "@/lib/prisma"
import { CouponDiscountType, PaymentStatus } from "@/generated/prisma/enums"

const couponInput = z.object({
  code: z.string().min(2, "Code must be at least 2 characters"),
  description: z.string().optional(),
  discountType: z.nativeEnum(CouponDiscountType),
  discountValue: z.number().positive("Discount value must be greater than 0"),
  enabled: z.boolean().default(true),
  // Conditions — all optional.
  minSubtotal: z.number().positive().nullable().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  serviceType: z.enum(["general", "wordpress"]).nullable().optional(),
  country: z.enum(["uk", "us"]).nullable().optional(),
  serviceIds: z.array(z.string()).optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  firstOrderOnly: z.boolean().optional(),
  startsAt: z.date().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
})

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/** Compute the discount amount a coupon yields against a subtotal. */
function computeDiscount(
  coupon: {
    discountType: CouponDiscountType
    discountValue: number
    maxDiscount: number | null
  },
  subtotal: number,
): number {
  let discount =
    coupon.discountType === CouponDiscountType.percent
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount)
  discount = Math.min(discount, subtotal)
  return round2(Math.max(0, discount))
}

/**
 * Derive the order context for an invoice: the service type(s), country(ies)
 * and service id(s) it covers. Used to evaluate coupon conditions.
 */
async function invoiceContext(invoice: { id: string; organizationId: string }) {
  const orders = await prisma.serviceOrder.findMany({
    where: { invoiceId: invoice.id },
    select: { serviceId: true },
  })
  const serviceIds = orders.map((o) => o.serviceId)
  const services = serviceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, type: true, country: true },
      })
    : []
  const org = await prisma.organization.findUnique({
    where: { id: invoice.organizationId },
    select: { country: true },
  })
  const types = new Set<string>(services.map((s) => s.type))
  const countries = new Set<string>()
  for (const s of services) if (s.country) countries.add(s.country)
  if (org?.country) countries.add(org.country)
  return {
    serviceIds,
    types,
    countries,
    hasServiceOrder: orders.length > 0,
  }
}

type CouponRow = Awaited<ReturnType<typeof prisma.coupon.findUnique>>

/**
 * Validate every condition on a coupon for the given user + invoice context.
 * Throws a TRPCError with a friendly message when a condition fails.
 * Returns the discount amount when it passes.
 */
async function evaluateCoupon(
  coupon: NonNullable<CouponRow>,
  args: {
    userId: string
    invoiceId: string
    subtotal: number
    ctx: Awaited<ReturnType<typeof invoiceContext>>
    orgIds: string[]
  },
): Promise<number> {
  const fail = (message: string): never => {
    throw new TRPCError({ code: "BAD_REQUEST", message })
  }

  if (!coupon.enabled) fail("This coupon is no longer active.")

  const now = new Date()
  if (coupon.startsAt && now < coupon.startsAt) {
    fail("This coupon isn't active yet.")
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    fail("This coupon has expired.")
  }

  if (coupon.minSubtotal != null && args.subtotal < coupon.minSubtotal) {
    fail(
      `This coupon requires a minimum order of $${coupon.minSubtotal.toFixed(2)}.`,
    )
  }

  if (coupon.serviceType) {
    if (!args.ctx.types.has(coupon.serviceType)) {
      fail("This coupon doesn't apply to the items on this order.")
    }
  }

  if (coupon.country) {
    if (!args.ctx.countries.has(coupon.country)) {
      fail("This coupon isn't valid for this order's region.")
    }
  }

  if (coupon.serviceIds.length > 0) {
    const overlap = args.ctx.serviceIds.some((id) =>
      coupon.serviceIds.includes(id),
    )
    if (!overlap) {
      fail("This coupon doesn't apply to the items on this order.")
    }
  }

  if (coupon.usageLimit != null) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, invoiceId: { not: args.invoiceId } },
    })
    if (used >= coupon.usageLimit) {
      fail("This coupon has reached its usage limit.")
    }
  }

  if (coupon.perUserLimit != null) {
    const usedByUser = await prisma.couponRedemption.count({
      where: {
        couponId: coupon.id,
        userId: args.userId,
        invoiceId: { not: args.invoiceId },
      },
    })
    if (usedByUser >= coupon.perUserLimit) {
      fail("You've already used this coupon the maximum number of times.")
    }
  }

  if (coupon.firstOrderOnly && args.orgIds.length > 0) {
    const priorPaid = await prisma.invoice.count({
      where: {
        organizationId: { in: args.orgIds },
        status: PaymentStatus.paid,
        id: { not: args.invoiceId },
      },
    })
    if (priorPaid > 0) {
      fail("This coupon is only valid on your first payment.")
    }
  }

  return computeDiscount(coupon, args.subtotal)
}

export const couponsRouter = router({
  // ---------- ADMIN ----------
  list: adminProcedure.query(async () => {
    const [coupons, counts] = await Promise.all([
      prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.couponRedemption.groupBy({
        by: ["couponId"],
        _count: { _all: true },
      }),
    ])
    const countMap = new Map(counts.map((c) => [c.couponId, c._count._all]))
    return coupons.map((c) => ({ ...c, redemptionCount: countMap.get(c.id) ?? 0 }))
  }),

  create: adminProcedure.input(couponInput).mutation(async ({ input }) => {
    const code = input.code.trim().toUpperCase()
    const existing = await prisma.coupon.findUnique({ where: { code } })
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `A coupon with code "${code}" already exists.`,
      })
    }
    return prisma.coupon.create({
      data: {
        code,
        description: input.description?.trim() || null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        enabled: input.enabled,
        minSubtotal: input.minSubtotal ?? null,
        maxDiscount: input.maxDiscount ?? null,
        serviceType: input.serviceType ?? null,
        country: input.country ?? null,
        serviceIds: input.serviceIds ?? [],
        usageLimit: input.usageLimit ?? null,
        perUserLimit: input.perUserLimit ?? null,
        firstOrderOnly: input.firstOrderOnly ?? false,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    })
  }),

  update: adminProcedure
    .input(couponInput.extend({ id: z.string() }))
    .mutation(async ({ input }) => {
      const code = input.code.trim().toUpperCase()
      const clash = await prisma.coupon.findFirst({
        where: { code, id: { not: input.id } },
        select: { id: true },
      })
      if (clash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A coupon with code "${code}" already exists.`,
        })
      }
      return prisma.coupon.update({
        where: { id: input.id },
        data: {
          code,
          description: input.description?.trim() || null,
          discountType: input.discountType,
          discountValue: input.discountValue,
          enabled: input.enabled,
          minSubtotal: input.minSubtotal ?? null,
          maxDiscount: input.maxDiscount ?? null,
          serviceType: input.serviceType ?? null,
          country: input.country ?? null,
          serviceIds: input.serviceIds ?? [],
          usageLimit: input.usageLimit ?? null,
          perUserLimit: input.perUserLimit ?? null,
          firstOrderOnly: input.firstOrderOnly ?? false,
          startsAt: input.startsAt ?? null,
          expiresAt: input.expiresAt ?? null,
        },
      })
    }),

  setEnabled: adminProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) =>
      prisma.coupon.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.coupon.delete({ where: { id: input.id } })
      return { ok: true }
    }),

  // ---------- CLIENT ----------
  /** Apply a coupon code to an unpaid invoice, discounting the amount due. */
  apply: protectedProcedure
    .input(z.object({ invoiceId: z.string(), code: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." })
      }
      await assertOrgMember(ctx.user.id, invoice.organizationId)
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invoice can no longer be changed.",
        })
      }

      const coupon = await prisma.coupon.findUnique({
        where: { code: input.code.trim().toUpperCase() },
      })
      if (!coupon) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That coupon code isn't valid.",
        })
      }

      const subtotal = invoice.originalAmount ?? invoice.amount
      const context = await invoiceContext(invoice)
      const members = await prisma.member.findMany({
        where: { userId: ctx.user.id },
        select: { organizationId: true },
      })
      const orgIds = members.map((m) => m.organizationId)

      const discount = await evaluateCoupon(coupon, {
        userId: ctx.user.id,
        invoiceId: invoice.id,
        subtotal,
        ctx: context,
        orgIds,
      })

      const newAmount = round2(subtotal - discount)

      const updated = await prisma.$transaction(async (db) => {
        // Replace any earlier redemption for this invoice.
        await db.couponRedemption.deleteMany({ where: { invoiceId: invoice.id } })
        await db.couponRedemption.create({
          data: {
            couponId: coupon.id,
            userId: ctx.user.id,
            invoiceId: invoice.id,
            amount: discount,
          },
        })
        return db.invoice.update({
          where: { id: invoice.id },
          data: {
            originalAmount: subtotal,
            discountAmount: discount,
            couponCode: coupon.code,
            couponId: coupon.id,
            amount: newAmount,
          },
        })
      })

      return {
        code: coupon.code,
        discount,
        amount: updated.amount,
        originalAmount: subtotal,
      }
    }),

  /** Remove an applied coupon from an unpaid invoice, restoring the amount. */
  remove: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." })
      }
      await assertOrgMember(ctx.user.id, invoice.organizationId)
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invoice can no longer be changed.",
        })
      }
      if (invoice.originalAmount == null) return { ok: true }

      await prisma.$transaction(async (db) => {
        await db.couponRedemption.deleteMany({ where: { invoiceId: invoice.id } })
        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            amount: invoice.originalAmount!,
            originalAmount: null,
            discountAmount: null,
            couponCode: null,
            couponId: null,
          },
        })
      })
      return { ok: true }
    }),
})
