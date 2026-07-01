import { prisma } from "./prisma"
import { sendMail, notifyAdmin, appUrl } from "./email"

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
) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  await sendMail(owner.email, "New invoice on your account", {
    heading: "You have a new invoice",
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: "A new invoice has been added to your account and is ready for payment.",
    details: [
      { label: "Amount", value: `$${invoice.amount}` },
      ...(invoice.description ? [{ label: "For", value: invoice.description }] : []),
    ],
    cta: { label: "View & Pay", url: appUrl(`/dashboard/invoices/${invoice.id}`) },
  })
}

export async function emailUserDocumentRequested(organizationId: string, docName: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  await sendMail(owner.email, "Document requested", {
    heading: "We need a document from you",
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: `Our team has requested a document to continue processing your company.`,
    details: [{ label: "Document", value: docName }],
    cta: { label: "Upload Document", url: appUrl("/dashboard/documents") },
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
  await sendMail(
    owner.email,
    approved ? "Document approved" : "Document needs attention",
    {
      heading: approved ? "Your document was approved" : "Your document was rejected",
      greeting: `Hi ${owner.name ?? "there"},`,
      intro: approved
        ? `Your document "${docName}" has been approved.`
        : `Your document "${docName}" was rejected and needs to be re-uploaded.`,
      details: !approved && reason ? [{ label: "Reason", value: reason }] : undefined,
      cta: { label: "View Documents", url: appUrl("/dashboard/documents") },
    },
  )
}

export async function emailUserStatusUpdate(organizationId: string, status: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  const name = await orgName(organizationId)
  await sendMail(owner.email, "Company status updated", {
    heading: "Your company status has changed",
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: `The status of ${name} has been updated.`,
    details: [{ label: "New status", value: statusLabels[status] ?? status }],
    cta: { label: "View Dashboard", url: appUrl("/dashboard") },
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
  await sendMail(owner.email, "Your company is ready 🎉", {
    heading: "Your company formation is complete",
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: `Great news — ${org.name} has been successfully formed.`,
    details,
    cta: { label: "View Dashboard", url: appUrl("/dashboard") },
  })
}

export async function emailUserNewMail(organizationId: string, subject: string) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  await sendMail(owner.email, "New mail received", {
    heading: "You have new mail",
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: "New mail has been added to your company account.",
    details: [{ label: "Subject", value: subject }],
    cta: { label: "Read Mail", url: appUrl("/dashboard/mail") },
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
  await sendMail(
    owner.email,
    approved ? "Payment confirmed" : "Payment could not be verified",
    {
      heading: approved ? "Payment confirmed" : "Payment rejected",
      greeting: `Hi ${owner.name ?? "there"},`,
      intro: approved
        ? `We've received and confirmed your payment of $${amount}.`
        : `We couldn't verify your payment of $${amount}. Please try again.`,
      details: !approved && reason ? [{ label: "Reason", value: reason }] : undefined,
      cta: { label: "View Invoices", url: appUrl("/dashboard/invoices") },
    },
  )
}

export async function emailUserOrderStatus(
  organizationId: string,
  orderId: string,
  serviceTitle: string,
  status: string,
) {
  const owner = await orgOwner(organizationId)
  if (!owner?.email) return
  await sendMail(owner.email, "Order status updated", {
    heading: "Your order status has changed",
    greeting: `Hi ${owner.name ?? "there"},`,
    intro: `Your order for "${serviceTitle}" is now ${statusLabels[status] ?? status}.`,
    cta: { label: "View Order", url: appUrl(`/dashboard/orders/${orderId}`) },
  })
}

export async function emailUserTicketReply(
  toEmail: string,
  toName: string | null,
  ticketId: string,
  subject: string,
) {
  await sendMail(toEmail, `Re: ${subject}`, {
    heading: "Support replied to your ticket",
    greeting: `Hi ${toName ?? "there"},`,
    intro: `Our support team replied to your ticket "${subject}".`,
    cta: { label: "View Ticket", url: appUrl(`/dashboard/tickets/${ticketId}`) },
  })
}

export async function emailUserTicketStatus(
  toEmail: string,
  toName: string | null,
  ticketId: string,
  subject: string,
  status: string,
) {
  await sendMail(toEmail, `Ticket ${statusLabels[status] ?? status}: ${subject}`, {
    heading: "Your ticket status changed",
    greeting: `Hi ${toName ?? "there"},`,
    intro: `The status of your ticket "${subject}" is now ${statusLabels[status] ?? status}.`,
    cta: { label: "View Ticket", url: appUrl(`/dashboard/tickets/${ticketId}`) },
  })
}

export async function emailUserWelcome(toEmail: string, toName: string | null) {
  await sendMail(toEmail, "Welcome to Webmosh", {
    heading: "Welcome to Webmosh",
    greeting: `Hi ${toName ?? "there"},`,
    intro:
      "Thanks for joining Webmosh. You can now form and manage your UK or US company from your dashboard.",
    cta: { label: "Get Started", url: appUrl("/dashboard") },
  })
}

// ---------- ADMIN NOTIFICATIONS ----------

export async function emailAdminNewTicket(
  userName: string | null,
  userEmail: string,
  ticketId: string,
  subject: string,
) {
  await notifyAdmin(`New support ticket: ${subject}`, {
    heading: "New support ticket",
    intro: "A customer has opened a new support ticket.",
    details: [
      { label: "From", value: `${userName ?? "—"} (${userEmail})` },
      { label: "Subject", value: subject },
    ],
    cta: { label: "View Ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
  })
}

export async function emailAdminTicketReply(
  userName: string | null,
  ticketId: string,
  subject: string,
) {
  await notifyAdmin(`Ticket reply: ${subject}`, {
    heading: "Customer replied to a ticket",
    intro: `${userName ?? "A customer"} replied to ticket "${subject}".`,
    cta: { label: "View Ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
  })
}

export async function emailAdminTicketClosed(
  userName: string | null,
  ticketId: string,
  subject: string,
) {
  await notifyAdmin(`Ticket closed: ${subject}`, {
    heading: "Customer closed a ticket",
    intro: `${userName ?? "A customer"} closed ticket "${subject}".`,
    cta: { label: "View Ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
  })
}

export async function emailAdminNewFormation(orgId: string, companyName: string, country: string) {
  await notifyAdmin(`New formation: ${companyName}`, {
    heading: "New company formation",
    intro: "A new company formation has been submitted.",
    details: [
      { label: "Company", value: companyName },
      { label: "Country", value: country.toUpperCase() },
    ],
    cta: { label: "Review Formation", url: appUrl(`/admin/formations/${orgId}`) },
  })
}

export async function emailAdminNewOrder(serviceTitle: string, orgName: string) {
  await notifyAdmin(`New service order: ${serviceTitle}`, {
    heading: "New service order",
    intro: "A customer has purchased a service.",
    details: [
      { label: "Service", value: serviceTitle },
      { label: "Company", value: orgName },
    ],
    cta: { label: "View Orders", url: appUrl("/admin/orders") },
  })
}

export async function emailAdminPaymentSubmitted(
  orgName: string,
  amount: number,
  method: string,
  transactionId: string,
) {
  await notifyAdmin("Payment submitted — needs verification", {
    heading: "A payment needs verification",
    intro: "A customer submitted a payment awaiting your confirmation.",
    details: [
      { label: "Company", value: orgName },
      { label: "Amount", value: `$${amount}` },
      { label: "Method", value: method },
      { label: "Transaction ID", value: transactionId },
    ],
    cta: { label: "Review Invoices", url: appUrl("/admin/invoices") },
  })
}

export async function emailAdminInvoicePaid(orgName: string, amount: number) {
  await notifyAdmin("Invoice paid", {
    heading: "An invoice was marked paid",
    intro: "A payment has been confirmed.",
    details: [
      { label: "Company", value: orgName },
      { label: "Amount", value: `$${amount}` },
    ],
    cta: { label: "View Invoices", url: appUrl("/admin/invoices") },
  })
}

export async function emailAdminDocumentResubmitted(orgId: string, docName: string, orgName: string) {
  await notifyAdmin("Document uploaded — needs review", {
    heading: "A document was uploaded",
    intro: "A customer uploaded a document that needs review.",
    details: [
      { label: "Company", value: orgName },
      { label: "Document", value: docName },
    ],
    cta: { label: "Review Formation", url: appUrl(`/admin/formations/${orgId}`) },
  })
}

export async function emailAdminNewUser(userName: string | null, userEmail: string) {
  await notifyAdmin("New user signed up", {
    heading: "New user registration",
    intro: "A new user just created an account.",
    details: [{ label: "User", value: `${userName ?? "—"} (${userEmail})` }],
    cta: { label: "View Users", url: appUrl("/admin/users") },
  })
}
