import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { adminProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { sendMail, appUrl } from "@/lib/email"
import {
  EMAIL_EVENTS,
  getEmailEventDef,
  renderTemplate,
} from "@/lib/email-templates"

const templateInput = z.object({
  event: z.string().min(1),
  subject: z.string().min(1),
  heading: z.string().min(1),
  intro: z.string().min(1),
  ctaLabel: z.string().optional(),
  enabled: z.boolean().default(true),
})

export const emailsRouter = router({
  /** Every email event with its defaults and (if any) the custom override. */
  list: adminProcedure.query(async () => {
    const overrides = await prisma.emailTemplate.findMany()
    const byEvent = new Map(overrides.map((o) => [o.event, o]))
    return EMAIL_EVENTS.map((def) => {
      const custom = byEvent.get(def.event) ?? null
      return {
        ...def,
        custom: custom
          ? {
              id: custom.id,
              subject: custom.subject,
              heading: custom.heading,
              intro: custom.intro,
              ctaLabel: custom.ctaLabel,
              enabled: custom.enabled,
              updatedAt: custom.updatedAt,
            }
          : null,
      }
    })
  }),

  /** Create or update the custom template for an event. */
  save: adminProcedure.input(templateInput).mutation(async ({ input }) => {
    if (!getEmailEventDef(input.event)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown email event." })
    }
    const data = {
      subject: input.subject.trim(),
      heading: input.heading.trim(),
      intro: input.intro.trim(),
      ctaLabel: input.ctaLabel?.trim() || null,
      enabled: input.enabled,
    }
    return prisma.emailTemplate.upsert({
      where: { event: input.event },
      create: { event: input.event, ...data },
      update: data,
    })
  }),

  /**
   * Pause or resume an email without editing its copy. Pausing an event that
   * has no custom template creates one from the defaults; resuming a template
   * whose copy still matches the defaults removes the row entirely so the
   * event shows as "Default" again.
   */
  setEnabled: adminProcedure
    .input(z.object({ event: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const def = getEmailEventDef(input.event)
      if (!def) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown email event." })
      }
      const existing = await prisma.emailTemplate.findUnique({
        where: { event: input.event },
      })
      if (!existing) {
        if (!input.enabled) {
          await prisma.emailTemplate.create({
            data: {
              event: input.event,
              subject: def.defaults.subject,
              heading: def.defaults.heading,
              intro: def.defaults.intro,
              ctaLabel: def.defaults.ctaLabel ?? null,
              enabled: false,
            },
          })
        }
        return { ok: true }
      }
      const matchesDefaults =
        existing.subject === def.defaults.subject &&
        existing.heading === def.defaults.heading &&
        existing.intro === def.defaults.intro &&
        (existing.ctaLabel ?? null) === (def.defaults.ctaLabel ?? null)
      if (input.enabled && matchesDefaults) {
        await prisma.emailTemplate.delete({ where: { event: input.event } })
      } else {
        await prisma.emailTemplate.update({
          where: { event: input.event },
          data: { enabled: input.enabled },
        })
      }
      return { ok: true }
    }),

  /** Delete the custom template — the event reverts to its built-in default. */
  reset: adminProcedure
    .input(z.object({ event: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.emailTemplate.deleteMany({ where: { event: input.event } })
      return { ok: true }
    }),

  /**
   * Send a test email to the signed-in admin using sample variable values.
   * Uses the draft passed in (so unsaved edits can be previewed), or the
   * stored/custom-or-default template when no draft is given.
   */
  sendTest: adminProcedure
    .input(
      z.object({
        event: z.string(),
        draft: z
          .object({
            subject: z.string(),
            heading: z.string(),
            intro: z.string(),
            ctaLabel: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const def = getEmailEventDef(input.event)
      if (!def) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown email event." })
      }
      const vars = Object.fromEntries(def.variables.map((v) => [v.name, v.sample]))
      let t: { subject: string; heading: string; intro: string; ctaLabel?: string } =
        input.draft ?? def.defaults
      if (!input.draft) {
        const custom = await prisma.emailTemplate.findUnique({
          where: { event: input.event },
        })
        if (custom) {
          t = {
            subject: custom.subject,
            heading: custom.heading,
            intro: custom.intro,
            ctaLabel: custom.ctaLabel ?? undefined,
          }
        }
      }
      await sendMail(ctx.user.email, `[Test] ${renderTemplate(t.subject, vars)}`, {
        heading: renderTemplate(t.heading, vars),
        greeting: `Hi ${ctx.user.name ?? "Admin"},`,
        intro: renderTemplate(t.intro, vars),
        details: def.variables.map((v) => ({
          label: `{{${v.name}}}`,
          value: v.sample,
        })),
        cta: {
          label: renderTemplate(t.ctaLabel ?? def.defaults.ctaLabel ?? "Open", vars),
          url: appUrl("/admin/emails"),
        },
      })
      return { ok: true }
    }),
})
