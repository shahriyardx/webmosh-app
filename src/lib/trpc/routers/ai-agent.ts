import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto"
import { logAudit } from "@/lib/audit"
import {
  getAnthropicKey,
  runAgentChat,
  runAgentConfirm,
  getModel,
  setModel,
  AI_MODELS,
} from "@/lib/ai-agent"

const KEY_NAME = "anthropic_api_key"

// Simple in-memory rate limiter (per admin, per server instance).
const hits = new Map<string, number[]>()
function rateLimit(userId: string, max = 20, windowMs = 60_000) {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests — please slow down.",
    })
  }
  recent.push(now)
  hits.set(userId, recent)
}

const messagesInput = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(8000),
    }),
  )
  .min(1)
  .max(40)

// Base64 image/PDF attachments for document extraction. Capped per-file and in
// count to stay well under Anthropic's 32MB request limit. Uploaded ID/financial
// docs are sensitive — they are sent only server→Anthropic, never persisted raw.
const attachmentsInput = z
  .array(
    z.object({
      kind: z.enum(["image", "pdf"]),
      mediaType: z.string().max(100),
      data: z.string().max(7_000_000), // base64 (~5.2MB decoded) per file
    }),
  )
  .max(4)
  .optional()

export const aiAgentRouter = router({
  /** Whether an Anthropic key is set, plus a masked preview only. */
  keyStatus: adminProcedure.query(async () => {
    const row = await prisma.integrationSetting.findUnique({
      where: { keyName: KEY_NAME },
    })
    if (!row) {
      const envKey = process.env.ANTHROPIC_API_KEY
      return {
        configured: !!envKey,
        preview: envKey ? maskSecret(envKey) : null,
        source: envKey ? ("env" as const) : null,
        updatedAt: null as Date | null,
      }
    }
    let preview: string | null = null
    try {
      preview = maskSecret(decryptSecret(row.encryptedValue))
    } catch {
      preview = null
    }
    return {
      configured: true,
      preview,
      source: "database" as const,
      updatedAt: row.updatedAt,
    }
  }),

  /** Save (encrypt) a new Anthropic key. */
  setKey: adminProcedure
    .input(z.object({ apiKey: z.string().min(10).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const key = input.apiKey.trim()
      if (!key.startsWith("sk-ant-")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That doesn't look like an Anthropic key (it should start with 'sk-ant-').",
        })
      }
      let encrypted: string
      try {
        encrypted = encryptSecret(key)
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Server encryption key (SETTINGS_ENCRYPTION_KEY) is not configured — can't store secrets securely.",
        })
      }
      await prisma.integrationSetting.upsert({
        where: { keyName: KEY_NAME },
        create: {
          keyName: KEY_NAME,
          encryptedValue: encrypted,
          updatedById: ctx.user.id,
        },
        update: { encryptedValue: encrypted, updatedById: ctx.user.id },
      })
      await logAudit({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        action: "ai.key.updated",
        targetType: "integration_setting",
        targetId: KEY_NAME,
      })
      return { ok: true }
    }),

  /** Remove the stored key entirely. */
  clearKey: adminProcedure.mutation(async ({ ctx }) => {
    await prisma.integrationSetting.deleteMany({ where: { keyName: KEY_NAME } })
    await logAudit({
      actorId: ctx.user.id,
      actorEmail: ctx.user.email,
      action: "ai.key.cleared",
      targetType: "integration_setting",
      targetId: KEY_NAME,
    })
    return { ok: true }
  }),

  /** Minimal connectivity test against Anthropic with the current key. */
  testKey: adminProcedure.mutation(async () => {
    const key = await getAnthropicKey()
    if (!key) return { ok: false, error: "No API key configured." }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: await getModel(),
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) return { ok: true as const }
      if (res.status === 401)
        return { ok: false as const, error: "API key rejected (401)." }
      return { ok: false as const, error: `Anthropic returned HTTP ${res.status}.` }
    } catch {
      return { ok: false as const, error: "Couldn't reach Anthropic." }
    }
  }),

  /** Currently selected model, plus the available options. */
  model: adminProcedure.query(async () => {
    return { model: await getModel(), options: AI_MODELS }
  }),

  /** Persist the admin's model choice. */
  setModel: adminProcedure
    .input(z.object({ model: z.string().max(64) }))
    .mutation(async ({ input, ctx }) => {
      try {
        await setModel(input.model, ctx.user.id)
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported model.",
        })
      }
      await logAudit({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        action: "ai.model.updated",
        targetType: "integration_setting",
        targetId: "ai_model",
        after: { model: input.model } as never,
      })
      return { ok: true }
    }),

  /** Send a message to the agent. May return a pending confirmation. */
  chat: adminProcedure
    .input(z.object({ messages: messagesInput, attachments: attachmentsInput }))
    .mutation(async ({ input, ctx }) => {
      rateLimit(ctx.user.id)
      await logAudit({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        action: "ai.chat",
        meta: {
          lastMessage: input.messages.at(-1)?.content?.slice(0, 500) ?? "",
          attachments: input.attachments?.length ?? 0,
        },
      })
      return runAgentChat({
        messages: input.messages,
        attachments: input.attachments,
        user: ctx.user,
      })
    }),

  /** Execute a previously-proposed confirmation-required action. */
  confirm: adminProcedure
    .input(z.object({ name: z.string().max(64), args: z.record(z.string(), z.any()) }))
    .mutation(async ({ input, ctx }) => {
      rateLimit(ctx.user.id)
      return runAgentConfirm({ name: input.name, args: input.args, user: ctx.user })
    }),
})
