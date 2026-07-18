import { prisma } from "./prisma"

/**
 * Registry of every email the app sends. Each event has default copy;
 * admins can override subject/heading/intro/ctaLabel (or disable the
 * email entirely) via the EmailTemplate table, managed at /admin/emails.
 *
 * Copy supports {{variable}} placeholders — the variables available for
 * each event are listed here so the admin UI can show them.
 */

export type EmailAudience = "customer" | "admin" | "freelancer"

export interface EmailVariable {
  name: string
  description: string
  sample: string
}

export interface EmailEventDef {
  event: string
  label: string
  description: string
  audience: EmailAudience
  variables: EmailVariable[]
  defaults: {
    subject: string
    heading: string
    intro: string
    ctaLabel?: string
  }
}

const v = (name: string, description: string, sample: string): EmailVariable => ({
  name,
  description,
  sample,
})

const NAME = v("name", "Recipient's first name (or \"there\")", "John")

export const EMAIL_EVENTS: EmailEventDef[] = [
  // ---------- CUSTOMER ----------
  {
    event: "user.invoice_created",
    label: "New invoice",
    description: "Sent to the client when a new invoice is issued.",
    audience: "customer",
    variables: [
      NAME,
      v("invoiceNumber", "Invoice number, e.g. INV-0042", "INV-0042"),
      v("amount", "Invoice total in USD", "149"),
    ],
    defaults: {
      subject: "You have a new invoice {{invoiceNumber}}",
      heading: "You have a new invoice {{invoiceNumber}}",
      intro:
        "A new payment has been added to your account. Here's a breakdown of the charges.",
      ctaLabel: "View & Pay",
    },
  },
  {
    event: "user.invoice_reminder",
    label: "Invoice reminder",
    description: "Sent when the admin nudges the client about an unpaid invoice.",
    audience: "customer",
    variables: [
      NAME,
      v("invoiceNumber", "Invoice number, e.g. INV-0042", "INV-0042"),
      v("amount", "Invoice total in USD", "149"),
    ],
    defaults: {
      subject: "Reminder: Invoice {{invoiceNumber}} is still awaiting payment",
      heading: "Reminder: Invoice {{invoiceNumber}} is still unpaid",
      intro:
        "This is a friendly reminder that your invoice is still awaiting payment. The breakdown is below — please settle at your earliest convenience.",
      ctaLabel: "View & Pay",
    },
  },
  {
    event: "user.document_requested",
    label: "Document requested",
    description: "Sent when the admin requests a document from the client.",
    audience: "customer",
    variables: [NAME, v("documentName", "Name of the requested document", "Passport copy")],
    defaults: {
      subject: "Document requested",
      heading: "We need a document from you",
      intro: "Our team has requested a document to continue processing your company.",
      ctaLabel: "Upload Document",
    },
  },
  {
    event: "user.document_approved",
    label: "Document approved",
    description: "Sent when an uploaded document is approved.",
    audience: "customer",
    variables: [NAME, v("documentName", "Name of the document", "Passport copy")],
    defaults: {
      subject: "Document approved",
      heading: "Your document was approved",
      intro: 'Your document "{{documentName}}" has been approved.',
      ctaLabel: "View Documents",
    },
  },
  {
    event: "user.document_rejected",
    label: "Document rejected",
    description: "Sent when an uploaded document is rejected.",
    audience: "customer",
    variables: [
      NAME,
      v("documentName", "Name of the document", "Passport copy"),
      v("reason", "Rejection reason given by the admin", "The scan is blurry"),
    ],
    defaults: {
      subject: "Document needs attention",
      heading: "Your document was rejected",
      intro: 'Your document "{{documentName}}" was rejected and needs to be re-uploaded.',
      ctaLabel: "View Documents",
    },
  },
  {
    event: "user.company_status_updated",
    label: "Company status updated",
    description: "Sent when a company formation changes status.",
    audience: "customer",
    variables: [
      NAME,
      v("companyName", "Company name", "Acme Ltd"),
      v("status", "New status label", "Processing"),
    ],
    defaults: {
      subject: "Company status updated",
      heading: "Your company status has changed",
      intro: "The status of {{companyName}} has been updated.",
      ctaLabel: "View Dashboard",
    },
  },
  {
    event: "user.company_completed",
    label: "Company completed",
    description: "Sent when a company formation is completed.",
    audience: "customer",
    variables: [NAME, v("companyName", "Company name", "Acme Ltd")],
    defaults: {
      subject: "Your company is ready 🎉",
      heading: "Your company formation is complete",
      intro: "Great news — {{companyName}} has been successfully formed.",
      ctaLabel: "View Dashboard",
    },
  },
  {
    event: "user.mail_received",
    label: "New mail received",
    description: "Sent when new scanned mail is added to a company account.",
    audience: "customer",
    variables: [NAME, v("mailSubject", "Subject of the mail item", "HMRC letter")],
    defaults: {
      subject: "New mail received",
      heading: "You have new mail",
      intro: "New mail has been added to your company account.",
      ctaLabel: "Read Mail",
    },
  },
  {
    event: "user.payment_approved",
    label: "Payment confirmed",
    description: "Sent when the admin confirms a submitted payment.",
    audience: "customer",
    variables: [NAME, v("amount", "Payment amount in USD", "149")],
    defaults: {
      subject: "Payment confirmed",
      heading: "Payment confirmed",
      intro: "We've received and confirmed your payment of ${{amount}}.",
      ctaLabel: "View Payments",
    },
  },
  {
    event: "user.payment_rejected",
    label: "Payment rejected",
    description: "Sent when a submitted payment could not be verified.",
    audience: "customer",
    variables: [
      NAME,
      v("amount", "Payment amount in USD", "149"),
      v("reason", "Rejection reason given by the admin", "Transaction ID not found"),
    ],
    defaults: {
      subject: "Payment could not be verified",
      heading: "Payment rejected",
      intro: "We couldn't verify your payment of ${{amount}}. Please try again.",
      ctaLabel: "View Payments",
    },
  },
  {
    event: "user.order_status_updated",
    label: "Order status updated",
    description: "Sent when a service order changes status.",
    audience: "customer",
    variables: [
      NAME,
      v("serviceTitle", "Title of the ordered service", "Business Website"),
      v("status", "New status label", "Completed"),
    ],
    defaults: {
      subject: "Order status updated",
      heading: "Your order status has changed",
      intro: 'Your order for "{{serviceTitle}}" is now {{status}}.',
      ctaLabel: "View Order",
    },
  },
  {
    event: "user.ticket_reply",
    label: "Ticket reply",
    description: "Sent when support replies to a client's ticket.",
    audience: "customer",
    variables: [NAME, v("ticketSubject", "Ticket subject", "Question about my invoice")],
    defaults: {
      subject: "Re: {{ticketSubject}}",
      heading: "Support replied to your ticket",
      intro: 'Our support team replied to your ticket "{{ticketSubject}}".',
      ctaLabel: "View Ticket",
    },
  },
  {
    event: "user.ticket_status",
    label: "Ticket status changed",
    description: "Sent when a ticket's status changes (e.g. closed).",
    audience: "customer",
    variables: [
      NAME,
      v("ticketSubject", "Ticket subject", "Question about my invoice"),
      v("status", "New status label", "Closed"),
    ],
    defaults: {
      subject: "Ticket {{status}}: {{ticketSubject}}",
      heading: "Your ticket status changed",
      intro: 'The status of your ticket "{{ticketSubject}}" is now {{status}}.',
      ctaLabel: "View Ticket",
    },
  },
  {
    event: "user.welcome",
    label: "Welcome",
    description: "Sent to every new user after their first sign-in.",
    audience: "customer",
    variables: [NAME],
    defaults: {
      subject: "Welcome to Webmosh",
      heading: "Welcome to Webmosh",
      intro:
        "Thanks for joining Webmosh. You can now form and manage your UK or US company from your dashboard.",
      ctaLabel: "Get Started",
    },
  },

  // ---------- FREELANCER ----------
  {
    event: "freelancer.invite",
    label: "Freelancer invitation",
    description: "Sent when the admin invites someone to join as a freelancer.",
    audience: "freelancer",
    variables: [v("email", "Invited email address", "jane@example.com")],
    defaults: {
      subject: "You have been invited to join Webmosh as a freelancer",
      heading: "You're invited",
      intro:
        "Our admin team has invited you to join Webmosh as a freelancer. Sign in with your Google account (using this email) and you'll be taken to your freelancer workspace, where any tasks assigned to you will appear.",
      ctaLabel: "Sign in with Google",
    },
  },

  // ---------- ADMIN ----------
  {
    event: "admin.ticket_created",
    label: "New support ticket",
    description: "Alerts the admin when a customer opens a ticket.",
    audience: "admin",
    variables: [
      v("userName", "Customer's name", "John Doe"),
      v("userEmail", "Customer's email", "john@example.com"),
      v("ticketSubject", "Ticket subject", "Question about my invoice"),
    ],
    defaults: {
      subject: "New support ticket: {{ticketSubject}}",
      heading: "New support ticket",
      intro: "A customer has opened a new support ticket.",
      ctaLabel: "View Ticket",
    },
  },
  {
    event: "admin.ticket_reply",
    label: "Ticket reply (customer)",
    description: "Alerts the admin when a customer replies to a ticket.",
    audience: "admin",
    variables: [
      v("userName", "Customer's name", "John Doe"),
      v("ticketSubject", "Ticket subject", "Question about my invoice"),
    ],
    defaults: {
      subject: "Ticket reply: {{ticketSubject}}",
      heading: "Customer replied to a ticket",
      intro: '{{userName}} replied to ticket "{{ticketSubject}}".',
      ctaLabel: "View Ticket",
    },
  },
  {
    event: "admin.ticket_closed",
    label: "Ticket closed (customer)",
    description: "Alerts the admin when a customer closes a ticket.",
    audience: "admin",
    variables: [
      v("userName", "Customer's name", "John Doe"),
      v("ticketSubject", "Ticket subject", "Question about my invoice"),
    ],
    defaults: {
      subject: "Ticket closed: {{ticketSubject}}",
      heading: "Customer closed a ticket",
      intro: '{{userName}} closed ticket "{{ticketSubject}}".',
      ctaLabel: "View Ticket",
    },
  },
  {
    event: "admin.formation_created",
    label: "New formation",
    description: "Alerts the admin when a company formation is submitted.",
    audience: "admin",
    variables: [
      v("companyName", "Company name", "Acme Ltd"),
      v("country", "Country code (UK/US)", "UK"),
    ],
    defaults: {
      subject: "New formation: {{companyName}}",
      heading: "New company formation",
      intro: "A new company formation has been submitted.",
      ctaLabel: "Review Formation",
    },
  },
  {
    event: "admin.order_placed",
    label: "New service order",
    description: "Alerts the admin when a customer purchases a service.",
    audience: "admin",
    variables: [
      v("serviceTitle", "Title of the ordered service", "Business Website"),
      v("companyName", "Company / customer name", "Acme Ltd"),
    ],
    defaults: {
      subject: "New service order: {{serviceTitle}}",
      heading: "New service order",
      intro: "A customer has purchased a service.",
      ctaLabel: "View Orders",
    },
  },
  {
    event: "admin.payment_submitted",
    label: "Payment submitted",
    description: "Alerts the admin when a customer submits a payment for verification.",
    audience: "admin",
    variables: [
      v("companyName", "Company name", "Acme Ltd"),
      v("amount", "Payment amount in USD", "149"),
      v("method", "Payment method", "bank"),
      v("transactionId", "Transaction reference", "TX-12345"),
    ],
    defaults: {
      subject: "Payment submitted — needs verification",
      heading: "A payment needs verification",
      intro: "A customer submitted a payment awaiting your confirmation.",
      ctaLabel: "Review Invoices",
    },
  },
  {
    event: "admin.invoice_paid",
    label: "Invoice paid",
    description: "Alerts the admin when an invoice is marked paid.",
    audience: "admin",
    variables: [
      v("companyName", "Company name", "Acme Ltd"),
      v("amount", "Invoice amount in USD", "149"),
    ],
    defaults: {
      subject: "Invoice paid",
      heading: "An invoice was marked paid",
      intro: "A payment has been confirmed.",
      ctaLabel: "View Invoices",
    },
  },
  {
    event: "admin.document_submitted",
    label: "Document uploaded",
    description: "Alerts the admin when a customer uploads a document for review.",
    audience: "admin",
    variables: [
      v("companyName", "Company name", "Acme Ltd"),
      v("documentName", "Name of the document", "Passport copy"),
    ],
    defaults: {
      subject: "Document uploaded — needs review",
      heading: "A document was uploaded",
      intro: "A customer uploaded a document that needs review.",
      ctaLabel: "Review Formation",
    },
  },
  {
    event: "admin.user_signup",
    label: "New user signup",
    description: "Alerts the admin when a new user creates an account.",
    audience: "admin",
    variables: [
      v("userName", "User's name", "John Doe"),
      v("userEmail", "User's email", "john@example.com"),
    ],
    defaults: {
      subject: "New user signed up",
      heading: "New user registration",
      intro: "A new user just created an account.",
      ctaLabel: "View Users",
    },
  },
]

export type EmailEvent = (typeof EMAIL_EVENTS)[number]["event"]

const eventMap = new Map(EMAIL_EVENTS.map((e) => [e.event, e]))

export function getEmailEventDef(event: string) {
  return eventMap.get(event)
}

/** Replace {{var}} placeholders. Unknown placeholders are left as-is. */
export function renderTemplate(str: string, vars: Record<string, string>) {
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  )
}

export interface ResolvedTemplate {
  subject: string
  heading: string
  intro: string
  ctaLabel?: string
}

/**
 * Resolve the copy for an email event: the admin's custom template if one
 * exists (or null if they disabled the email), otherwise the built-in
 * default. Never throws — falls back to defaults on DB errors.
 */
export async function resolveTemplate(
  event: string,
  vars: Record<string, string> = {},
): Promise<ResolvedTemplate | null> {
  const def = eventMap.get(event)
  if (!def) return null

  let custom: {
    subject: string
    heading: string
    intro: string
    ctaLabel: string | null
    enabled: boolean
  } | null = null
  try {
    custom = await prisma.emailTemplate.findUnique({
      where: { event },
      select: {
        subject: true,
        heading: true,
        intro: true,
        ctaLabel: true,
        enabled: true,
      },
    })
  } catch (err) {
    console.error("[email-templates] lookup failed, using defaults:", event, err)
  }

  if (custom && !custom.enabled) return null

  const t = custom ?? def.defaults
  return {
    subject: renderTemplate(t.subject, vars),
    heading: renderTemplate(t.heading, vars),
    intro: renderTemplate(t.intro, vars),
    ctaLabel: t.ctaLabel ? renderTemplate(t.ctaLabel, vars) : def.defaults.ctaLabel,
  }
}
