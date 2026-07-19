import { prisma } from "./prisma"

export type NotificationKind =
  | "formation.created"
  | "formation.imported"
  | "order.placed"
  | "order.quoted"
  | "invoice.payment_submitted"
  | "invoice.paid"
  | "ticket.created"
  | "payout.requested"
  | "document.submitted"
  | "user.signup"
  | "wallet.topup_submitted"
  | "wallet.payout_requested"
  | "discussion.message"

/**
 * Create a single global admin notification. Never throws — logs and swallows.
 * Callers should treat this as fire-and-forget.
 */
export async function createAdminNotification(input: {
  kind: NotificationKind
  title: string
  body?: string
  link?: string
}) {
  try {
    await prisma.notification.create({
      data: {
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })
  } catch (err) {
    console.error("Failed to create admin notification", err)
  }
}
