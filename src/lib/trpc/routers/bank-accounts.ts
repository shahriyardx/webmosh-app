import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"

export const bankAccountInput = z.object({
  label: z.string().optional(),
  method: z.string().min(1),
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  bankName: z.string().optional(),
  branch: z.string().optional(),
  routingNumber: z.string().optional(),
  swift: z.string().optional(),
  iban: z.string().optional(),
})

const bankAccountSelect = {
  id: true,
  label: true,
  method: true,
  accountName: true,
  accountNumber: true,
  bankName: true,
  branch: true,
  routingNumber: true,
  swift: true,
  iban: true,
  createdAt: true,
} as const

/**
 * Saved payout/bank accounts, available to any signed-in user (clients and
 * freelancers). Used by the wallet payout and freelancer payout forms so the
 * user can pick a saved account instead of re-typing their details.
 */
export const bankAccountsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    prisma.bankAccount.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      select: bankAccountSelect,
    }),
  ),

  create: protectedProcedure
    .input(bankAccountInput)
    .mutation(({ input, ctx }) =>
      prisma.bankAccount.create({
        data: {
          userId: ctx.user.id,
          label: input.label?.trim() || null,
          method: input.method,
          accountName: input.accountName.trim(),
          accountNumber: input.accountNumber.trim(),
          bankName: input.bankName?.trim() || null,
          branch: input.branch?.trim() || null,
          routingNumber: input.routingNumber?.trim() || null,
          swift: input.swift?.trim() || null,
          iban: input.iban?.trim() || null,
        },
        select: bankAccountSelect,
      }),
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const acc = await prisma.bankAccount.findUnique({
        where: { id: input.id },
        select: { userId: true },
      })
      if (!acc || acc.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      await prisma.bankAccount.delete({ where: { id: input.id } })
      return { ok: true }
    }),
})

/**
 * Shared helper: persist a bank account for a user from payout input. Never
 * throws — a failed save shouldn't block the payout request itself.
 */
export async function saveBankAccountForUser(
  userId: string,
  data: {
    method: string
    accountName: string
    accountNumber: string
    bankName?: string
    branch?: string
    routingNumber?: string
    swift?: string
    iban?: string
  },
) {
  try {
    await prisma.bankAccount.create({
      data: {
        userId,
        method: data.method,
        accountName: data.accountName.trim(),
        accountNumber: data.accountNumber.trim(),
        bankName: data.bankName?.trim() || null,
        branch: data.branch?.trim() || null,
        routingNumber: data.routingNumber?.trim() || null,
        swift: data.swift?.trim() || null,
        iban: data.iban?.trim() || null,
      },
    })
  } catch (err) {
    console.error("Failed to save bank account", err)
  }
}
