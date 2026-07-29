import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

type JsonInput = Prisma.InputJsonValue | undefined

/**
 * Append an entry to the audit trail. Best-effort — auditing must never break
 * the operation it records. Never pass secret values (keys, passwords).
 */
export async function logAudit(entry: {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  before?: JsonInput
  after?: JsonInput
  meta?: JsonInput
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        before: entry.before,
        after: entry.after,
        meta: entry.meta,
      },
    })
  } catch {
    // Swallow — the recorded action already happened; don't fail on logging.
  }
}
