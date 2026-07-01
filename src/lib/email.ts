import { Resend } from "resend"
import { env } from "./env"
import { NotificationEmail, type NotificationEmailProps } from "@/emails/notification-email"

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const APP_URL = env.APP_URL.replace(/\/$/, "")
const ADMIN_EMAIL = env.ADMIN_EMAIL

export function appUrl(path = ""): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`
}

/**
 * Fire-and-forget email. Never throws — logs on failure so it can't break a mutation.
 */
export async function sendMail(
  to: string | string[],
  subject: string,
  props: NotificationEmailProps,
): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping:", subject)
    return
  }
  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      react: NotificationEmail({ logoUrl: appUrl("/logo.png"), ...props }),
    })
  } catch (err) {
    console.error("[email] send failed:", subject, err)
  }
}

export function notifyAdmin(subject: string, props: NotificationEmailProps): Promise<void> {
  return sendMail(ADMIN_EMAIL, subject, props)
}
