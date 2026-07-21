import { prisma } from "./prisma"
import { sendMail, notifyAdmin, appUrl } from "./email"
import { formatInvoiceNumber } from "./invoice-number"
import { resolveTemplate } from "./email-templates"

/** Owner (email + name) of an organization, or null. */
async function orgOwner(organizationId: string) {
  const member = await prisma.member.findFirst({
    where: { organizationId, role: "owner" },
    include: { user: { select: { email: true, name: true } } },
  })
  return member?.user ?? null
}

async function orgName(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  })
  return org?.name ?? "your company"
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  rejected: "Rejected",
  open: "Open",
  closed: "Closed",
  unpaid: "Unpaid",
  paid: "Paid",
}

// ---------- USER NOTIFICATIONS ----------

export async function emailUserNewInvoice(
  organizationId: string,
  invoice: { id: string; amount: number; description?: string | null },
  override?: { toEmail?: string; toName?: string; reminder?: boolean },
) {
  let toEmail = override?.toEmail
  let toName = override?.toName
  if (!toEmail) {
    const owner = await orgOwner(organizationId)
    if (!owner?.email) return
    toEmail = owner.email
    toName = toName ?? owner.name ?? undefined
  }
  const isReminder = override?.reminder === true

  // Fetch the stored line items (advanced create dialog) + sequential number
  // — fall back to a single row from the description/amount for legacy invoices.
  const stored = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    select: { items: true, amount: true, description: true, number: true },
  })
  const raw = stored?.items as
    | { title: string; amount: number }[]
    | null
    | undefined
  const items =
    Array.isArray(raw) && raw.length > 0
      ? raw.map((r) => ({ title: r.title, amount: r.amount }))
      : [
          {
            title: invoice.description || "Company Formation",
            amount: invoice.amount,
          },
        ]

  const invoiceNumber = formatInvoiceNumber(stored?.number)
  const t = await resolveTemplate(
    isReminder ? "user.invoice_reminder" : "user.invoice_created",
    {
      name: toName ?? "there",
      invoiceNumber,
      amount: String(invoice.amount),
    },
  )
  if (!t) return
  await sendMail(toEmail, t.subject, {
    heading: t.heading,
    greeting: `Hi ${toName ?? "there"},`,
    intro: t.intro,
    items,
    total: invoice.amount,
    cta: {
      label: t.ctaLabel ?? "View & Pay",
      url: appUrl(`/companies/${organizationId}/invoices/${invoice.id}`),
    },
  })
}

export async function emailUserDocumentRequested(organizationId: string, docName: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const t = await resolveTemplate("user.document_requested", {
    name: owner.name ?? "there",
    documentName: docName,
  })
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    details: [{ label: "Document", value: docName }],
    cta: {
      label: t.ctaLabel ?? "Upload Document",
      url: appUrl(`/companies/${organizationId}/documents`),
    },
  })
}

export async function emailUserDocumentReviewed(
  organizationId: string,
  docName: string,
  approved: boolean,
  reason?: string | null,
) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const t = await resolveTemplate(
    approved ? "user.document_approved" : "user.document_rejected",
    {
      name: owner.name ?? "there",
      documentName: docName,
      reason: reason ?? "",
    },
  )
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    details: !approved && reason ? [{ label: "Reason", value: reason }] : undefined,
    cta: {
      label: t.ctaLabel ?? "View Documents",
      url: appUrl(`/companies/${organizationId}/documents`),
    },
  })
}

export async function emailUserStatusUpdate(organizationId: string, status: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const name = await orgName(organizationId)
  const statusLabel = statusLabels[status] ?? status
  const t = await resolveTemplate("user.company_status_updated", {
    name: owner.name ?? "there",
    companyName: name,
    status: statusLabel,
  })
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    details: [{ label: "New status", value: statusLabel }],
    cta: {
      label: t.ctaLabel ?? "View Dashboard",
      url: appUrl(`/companies/${organizationId}/overview`),
    },
  })
}

export async function emailUserCompanyCompleted(organizationId: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, companyId: true, authCode: true, country: true },
  })
  if (!org) return
  const details = [{ label: "Company", value: org.name }]
  if (org.country === "uk" && org.companyId)
    details.push({ label: "Company ID", value: org.companyId })
  if (org.country === "uk" && org.authCode)
    details.push({ label: "Auth Code", value: org.authCode })
  const t = await resolveTemplate("user.company_completed", {
    name: owner.name ?? "there",
    companyName: org.name,
  })
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    details,
    cta: {
      label: t.ctaLabel ?? "View Dashboard",
      url: appUrl(`/companies/${organizationId}/overview`),
    },
  })
}

export async function emailUserNewMail(organizationId: string, subject: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const t = await resolveTemplate("user.mail_received", {
    name: owner.name ?? "there",
    mailSubject: subject,
  })
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    details: [{ label: "Subject", value: subject }],
    cta: {
      label: t.ctaLabel ?? "Read Mail",
      url: appUrl(`/companies/${organizationId}/mail`),
    },
  })
}

export async function emailUserPayment(
  organizationId: string,
  approved: boolean,
  amount: number,
  reason?: string | null,
) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const t = await resolveTemplate(
    approved ? "user.payment_approved" : "user.payment_rejected",
    {
      name: owner.name ?? "there",
      amount: String(amount),
      reason: reason ?? "",
    },
  )
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    details: !approved && reason ? [{ label: "Reason", value: reason }] : undefined,
    cta: {
      label: t.ctaLabel ?? "View Payments",
      url: appUrl(`/companies/${organizationId}/invoices`),
    },
  })
}

export async function emailUserOrderStatus(
  organizationId: string,
  orderId: string,
  serviceTitle: string,
  status: string,
) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const t = await resolveTemplate("user.order_status_updated", {
    name: owner.name ?? "there",
    serviceTitle,
    status: statusLabels[status] ?? status,
  })
  if (!t) return
  await sendMail(owner.email, t.subject, {
    heading: t.heading,
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: t.intro,
    cta: {
      label: t.ctaLabel ?? "View Order",
      url: appUrl(`/companies/${organizationId}/orders/${orderId}`),
    },
  })
}

function ticketUrl(organizationId: string | null, ticketId: string) {
  return organizationId
    ? appUrl(`/companies/${organizationId}/tickets/${ticketId}`)
    : appUrl("/dashboard")
}

export async function emailUserTicketReply(
  toEmail: string,
  toName: string | null,
  ticketId: string,
  subject: string,
  organizationId: string | null,
) {
  const t = await resolveTemplate("user.ticket_reply", {
    name: toName ?? "there",
    ticketSubject: subject,
  })
  if (!t) return
  await sendMail(toEmail, t.subject, {
    heading: t.heading,
    greeting: `Hi ${toName ?? "there"},`,
    intro: t.intro,
    cta: { label: t.ctaLabel ?? "View Ticket", url: ticketUrl(organizationId, ticketId) },
  })
}

export async function emailUserTicketStatus(
  toEmail: string,
  toName: string | null,
  ticketId: string,
  subject: string,
  status: string,
  organizationId: string | null,
) {
  const t = await resolveTemplate("user.ticket_status", {
    name: toName ?? "there",
    ticketSubject: subject,
    status: statusLabels[status] ?? status,
  })
  if (!t) return
  await sendMail(toEmail, t.subject, {
    heading: t.heading,
    greeting: `Hi ${toName ?? "there"},`,
    intro: t.intro,
    cta: { label: t.ctaLabel ?? "View Ticket", url: ticketUrl(organizationId, ticketId) },
  })
}

export async function emailUserWelcome(toEmail: string, toName: string | null) {
  const t = await resolveTemplate("user.welcome", { name: toName ?? "there" })
  if (!t) return
  await sendMail(toEmail, t.subject, {
    heading: t.heading,
    greeting: `Hi ${toName ?? "there"},`,
    intro: t.intro,
    cta: { label: t.ctaLabel ?? "Get Started", url: appUrl("/dashboard") },
  })
}

export async function emailFreelancerInvite(toEmail: string) {
  const t = await resolveTemplate("freelancer.invite", { email: toEmail })
  if (!t) return
  await sendMail(toEmail, t.subject, {
    heading: t.heading,
    greeting: "Hi,",
    intro: t.intro,
    cta: { label: t.ctaLabel ?? "Sign in with Google", url: appUrl("/") },
  })
}

export async function emailFreelancerTaskAssigned(
  toEmail: string,
  toName: string | null,
  args: {
    taskId: string
    taskTitle: string
    priority: string
    deadline: Date | null
  },
) {
  const first = toName?.split(" ")[0] || "there"
  const t = await resolveTemplate("freelancer.task_assigned", {
    name: first,
    taskTitle: args.taskTitle,
    priority: args.priority
      ? args.priority.charAt(0).toUpperCase() + args.priority.slice(1)
      : "Medium",
    deadline: args.deadline
      ? new Date(args.deadline).toLocaleDateString()
      : "No deadline",
  })
  if (!t) return
  await sendMail(toEmail, t.subject, {
    heading: t.heading,
    greeting: `Hi ${first},`,
    intro: t.intro,
    cta: {
      label: t.ctaLabel ?? "View Task",
      url: appUrl(`/freelancer/tasks/${args.taskId}`),
    },
  })
}

// ---------- ADMIN NOTIFICATIONS ----------

export async function emailAdminNewTicket(
  userName: string | null,
  userEmail: string,
  ticketId: string,
  subject: string,
) {
  const t = await resolveTemplate("admin.ticket_created", {
    userName: userName ?? "—",
    userEmail,
    ticketSubject: subject,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [
      { label: "From", value: `${userName ?? "—"} (${userEmail})` },
      { label: "Subject", value: subject },
    ],
    cta: { label: t.ctaLabel ?? "View Ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
  })
}

export async function emailAdminTicketReply(
  userName: string | null,
  ticketId: string,
  subject: string,
) {
  const t = await resolveTemplate("admin.ticket_reply", {
    userName: userName ?? "A customer",
    ticketSubject: subject,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    cta: { label: t.ctaLabel ?? "View Ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
  })
}

export async function emailAdminTicketClosed(
  userName: string | null,
  ticketId: string,
  subject: string,
) {
  const t = await resolveTemplate("admin.ticket_closed", {
    userName: userName ?? "A customer",
    ticketSubject: subject,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    cta: { label: t.ctaLabel ?? "View Ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
  })
}

export async function emailAdminNewFormation(orgId: string, companyName: string, country: string) {
  const t = await resolveTemplate("admin.formation_created", {
    companyName,
    country: country.toUpperCase(),
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [
      { label: "Company", value: companyName },
      { label: "Country", value: country.toUpperCase() },
    ],
    cta: { label: t.ctaLabel ?? "Review Formation", url: appUrl(`/admin/formations/${orgId}`) },
  })
}

export async function emailAdminNewOrder(serviceTitle: string, orgName: string) {
  const t = await resolveTemplate("admin.order_placed", {
    serviceTitle,
    companyName: orgName,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [
      { label: "Service", value: serviceTitle },
      { label: "Company", value: orgName },
    ],
    cta: { label: t.ctaLabel ?? "View Orders", url: appUrl("/admin/orders") },
  })
}

export async function emailAdminPaymentSubmitted(
  orgName: string,
  amount: number,
  method: string,
  transactionId: string,
) {
  const t = await resolveTemplate("admin.payment_submitted", {
    companyName: orgName,
    amount: String(amount),
    method,
    transactionId,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [
      { label: "Company", value: orgName },
      { label: "Amount", value: `$${amount}` },
      { label: "Method", value: method },
      { label: "Transaction ID", value: transactionId },
    ],
    cta: { label: t.ctaLabel ?? "Review Invoices", url: appUrl("/admin/invoices") },
  })
}

export async function emailAdminInvoicePaid(orgName: string, amount: number) {
  const t = await resolveTemplate("admin.invoice_paid", {
    companyName: orgName,
    amount: String(amount),
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [
      { label: "Company", value: orgName },
      { label: "Amount", value: `$${amount}` },
    ],
    cta: { label: t.ctaLabel ?? "View Invoices", url: appUrl("/admin/invoices") },
  })
}

export async function emailAdminDocumentResubmitted(orgId: string, docName: string, orgName: string) {
  const t = await resolveTemplate("admin.document_submitted", {
    companyName: orgName,
    documentName: docName,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [
      { label: "Company", value: orgName },
      { label: "Document", value: docName },
    ],
    cta: { label: t.ctaLabel ?? "Review Formation", url: appUrl(`/admin/formations/${orgId}`) },
  })
}

export async function emailAdminNewUser(userName: string | null, userEmail: string) {
  const t = await resolveTemplate("admin.user_signup", {
    userName: userName ?? "—",
    userEmail,
  })
  if (!t) return
  await notifyAdmin(t.subject, {
    heading: t.heading,
    intro: t.intro,
    details: [{ label: "User", value: `${userName ?? "—"} (${userEmail})` }],
    cta: { label: t.ctaLabel ?? "View Users", url: appUrl("/admin/users") },
  })
}
