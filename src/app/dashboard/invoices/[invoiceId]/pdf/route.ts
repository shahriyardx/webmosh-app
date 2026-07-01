import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { renderInvoicePdf, type InvoicePdfData } from "@/lib/invoice-pdf"
import { env } from "@/lib/env"
import QRCode from "qrcode"

export const runtime = "nodejs"

const QR_CONTENT =
  "00020101021126540013com.pathaopay01020302041008031991008200186593649045204739953030505802BD5907WEBMOSH60045460625002110186593649003085594973007082f9893880807PAYMENT63049E3F"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return new Response("Not found", { status: 404 })

  const isAdmin = session.user?.role === "admin"
  if (!isAdmin) {
    const member = await prisma.member.findFirst({
      where: { organizationId: invoice.organizationId, userId: session.user.id },
      select: { id: true },
    })
    if (!member) return new Response("Forbidden", { status: 403 })
  }

  // Resolve line item (service order → service, else package, else generic)
  let item = { title: invoice.description || "Company Formation", features: [] as string[] }
  const order = await prisma.serviceOrder.findFirst({ where: { invoiceId } })
  if (order) {
    const svc = await prisma.service.findUnique({ where: { id: order.serviceId } })
    if (svc) item = { title: svc.title, features: svc.features }
  } else {
    const org = await prisma.organization.findUnique({
      where: { id: invoice.organizationId },
      select: { packageId: true },
    })
    if (org?.packageId) {
      const pkg = await prisma.package.findUnique({ where: { id: org.packageId } })
      if (pkg) item = { title: pkg.title, features: pkg.features }
    }
  }

  // Bill To — prefer director details, fall back to org owner
  const director = await prisma.director.findFirst({
    where: { organizationId: invoice.organizationId },
    orderBy: { createdAt: "asc" },
  })
  const owner = await prisma.member.findFirst({
    where: { organizationId: invoice.organizationId, role: "owner" },
    include: { user: { select: { name: true, email: true } } },
  })
  const billTo = director
    ? {
        name: `${director.firstName} ${director.lastName}`,
        phone: director.phone,
        email: director.email,
        address: director.address,
      }
    : {
        name: owner?.user?.name ?? "Customer",
        email: owner?.user?.email ?? null,
      }

  const qrDataUrl =
    invoice.status === "paid"
      ? undefined
      : await QRCode.toDataURL(QR_CONTENT, { margin: 1, width: 300 }).catch(() => undefined)

  const settingRows = await prisma.setting.findMany({
    where: {
      key: { in: ["invoice_from_name", "invoice_from_address", "invoice_from_phone", "invoice_from_email"] },
    },
  })
  const settings: Record<string, string> = {}
  for (const r of settingRows) settings[r.key] = r.value

  const data: InvoicePdfData = {
    invoiceNumber: invoice.id.slice(-8).toUpperCase(),
    date: new Date(invoice.createdAt).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    status: invoice.status as InvoicePdfData["status"],
    amount: invoice.amount,
    logoUrl: `${env.APP_URL.replace(/\/$/, "")}/logo.png`,
    from: {
      name: settings.invoice_from_name,
      address: settings.invoice_from_address,
      phone: settings.invoice_from_phone,
      email: settings.invoice_from_email,
    },
    billTo,
    item,
    qrDataUrl,
  }

  let pdf: Buffer
  try {
    pdf = await renderInvoicePdf(data)
  } catch {
    // Logo fetch or render issue — retry without the logo
    pdf = await renderInvoicePdf({ ...data, logoUrl: undefined })
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${data.invoiceNumber}.pdf"`,
    },
  })
}
