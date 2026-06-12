import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { PaymentStatus } from "@/generated/prisma/enums"

export const invoicesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session?.session?.activeOrganizationId
    if (!orgId) return []
    return prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.id },
      })
      if (!invoice) return null

      // User can only view their own org's invoices unless admin
      const isAdmin = ctx.session?.user?.role === "admin"
      if (invoice.organizationId !== orgId && !isAdmin) return null

      return invoice
    }),

  listAll: adminProcedure
    .input(z.object({ status: z.nativeEnum(PaymentStatus).optional() }))
    .query(async ({ input }) => {
      const where = input.status ? { status: input.status } : {}
      return prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { name: true } },
        },
      })
    }),

  submitTransaction: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        paymentMethod: z.enum(["bkash", "nagad"]),
        transactionId: z.string().min(1, "Transaction ID is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      const invoice = await prisma.invoice.findUnique({
        where: { id: input.invoiceId },
      })
      if (!invoice || invoice.organizationId !== orgId) {
        throw new Error("Invoice not found")
      }
      if (invoice.status !== PaymentStatus.unpaid) {
        throw new Error("Invoice is not in unpaid status")
      }

      return prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paymentMethod: input.paymentMethod,
          transactionId: input.transactionId,
          status: PaymentStatus.processing,
        },
      })
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.invoice.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.paid,
          rejectReason: null,
        },
      })
    }),

  reject: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input }) => {
      return prisma.invoice.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.unpaid,
          rejectReason: input.reason,
          paymentMethod: null,
          transactionId: null,
        },
      })
    }),
})
