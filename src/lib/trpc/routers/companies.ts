import { z } from "zod"
import { adminProcedure, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { CompanyStatus, DocumentStatus, PaymentStatus } from "@/generated/prisma/enums"

const directorInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  dateOfBirth: z.string().min(1),
  address: z.string().min(1),
})

const createCompanySchema = z.object({
  country: z.enum(["us", "uk"]),
  companyName: z.string().min(1),
  sicCode: z.string().min(1),
  sicDescription: z.string().optional(),
  packageId: z.string().min(1),
  serviceIds: z.array(z.string()),
  passportUrl: z.string().min(1),
  bankStatementUrl: z.string().min(1),
  director: directorInput,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export const companiesRouter = router({
  checkName: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Company name is required"),
        country: z.enum(["us", "uk"]),
      }),
    )
    .output(
      z.object({
        available: z.boolean(),
        note: z.string().optional(),
        normalizedName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { name, country } = input

      if (country === "uk") {
        const searchName = name.trim()
        const baseName = searchName.replace(/\s+(LTD|LIMITED)$/i, "").trim()
        const variant = searchName.toUpperCase().endsWith(" LIMITED")
          ? "LIMITED"
          : "LTD"
        const otherVariant = variant === "LTD" ? "LIMITED" : "LTD"
        const otherName = `${baseName} ${otherVariant}`

        const apiKey = process.env.COMPANIES_HOUSE_API_KEY
        if (!apiKey) {
          return {
            available: true,
            note: "Name check unavailable. Proceed with caution.",
          }
        }

        try {
          const encodedQuery = encodeURIComponent(baseName)
          const response = await fetch(
            `https://api.company-information.service.gov.uk/search/companies?q=${encodedQuery}`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
              },
            },
          )

          if (!response.ok) {
            return {
              available: true,
              note: "Could not verify. Proceed with caution.",
            }
          }

          const data: { items?: { title: string }[] } = await response.json()
          const existingTitles =
            data.items?.map((i) => i.title.toLowerCase()) ?? []

          const exactMatch = existingTitles.includes(searchName.toLowerCase())
          const otherTaken = existingTitles.includes(otherName.toLowerCase())

          if (exactMatch) {
            return {
              available: false,
              note: otherTaken
                ? `Both ${baseName} LTD and ${baseName} LIMITED are taken.`
                : `${searchName} is taken. Try ${otherName} instead.`,
            }
          }

          return {
            available: true,
            note: otherTaken
              ? `${otherName} is taken, but ${searchName} is available.`
              : undefined,
          }
        } catch {
          return {
            available: true,
            note: "Could not verify. Proceed with caution.",
          }
        }
      }

      // US — placeholder
      return {
        available: true,
        note: "Name check is client-side for US formations.",
      }
    }),

  createCompany: protectedProcedure
    .input(createCompanySchema)
    .mutation(async ({ input }) => {
      const {
        country,
        companyName,
        sicCode,
        sicDescription,
        packageId,
        serviceIds,
        passportUrl,
        bankStatementUrl,
        director,
      } = input

      const slug = slugify(companyName)
      const hdrs = await headers()

      // Create org via better-auth (auto-creates Member with owner role)
      const org = await auth.api.createOrganization({
        body: { name: companyName, slug },
        headers: hdrs,
      })

      // Add custom fields
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          country,
          sicCode,
          sicDescription: sicDescription ?? null,
          packageId,
          serviceIds,
        },
      })

      // Create director record
      await prisma.director.create({
        data: {
          organizationId: org.id,
          firstName: director.firstName,
          lastName: director.lastName,
          email: director.email,
          phone: director.phone,
          dateOfBirth: director.dateOfBirth,
          address: director.address,
        },
      })

      // Create document records
      await prisma.document.createMany({
        data: [
          {
            name: "Passport",
            value: passportUrl,
            status: DocumentStatus.submitted,
            organizationId: org.id,
          },
          {
            name: "Bank Statement",
            value: bankStatementUrl,
            status: DocumentStatus.submitted,
            organizationId: org.id,
          },
        ],
      })

      // Calculate invoice amount from package + services
      const formationPkg = await prisma.package.findUnique({ where: { id: packageId } })
      const selectedSvcs = serviceIds.length > 0
        ? await prisma.service.findMany({ where: { id: { in: serviceIds } } })
        : []
      const pkgPrice = formationPkg?.price ?? 0
      const svcTotal = selectedSvcs.reduce((sum, s) => sum + s.price, 0)
      const amount = pkgPrice + svcTotal

      await prisma.invoice.create({
        data: {
          organizationId: org.id,
          amount,
          status: PaymentStatus.unpaid,
        },
      })

      return org
    }),

  submitDocument: protectedProcedure
    .input(z.object({ documentId: z.string(), fileUrl: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      if (!orgId) throw new Error("No active organization")

      // Verify document belongs to user's org
      const doc = await prisma.document.findFirst({
        where: { id: input.documentId, organizationId: orgId },
      })
      if (!doc) throw new Error("Document not found")

      return prisma.document.update({
        where: { id: input.documentId },
        data: { value: input.fileUrl, status: DocumentStatus.submitted },
        select: { id: true, name: true, value: true, status: true, createdAt: true, rejectReason: true },
      })
    }),

  getPendingDocCount: protectedProcedure
    .query(async ({ ctx }) => {
      const orgId = ctx.session?.session?.activeOrganizationId
      if (!orgId) return 0

      return prisma.document.count({
        where: {
          organizationId: orgId,
          status: { in: [DocumentStatus.requested, DocumentStatus.rejected] },
        },
      })
    }),

  getDocuments: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input }) => {
      return prisma.document.findMany({
        where: { organizationId: input.orgId },
        orderBy: { createdAt: "asc" },
      })
    }),

  getOverview: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input }) => {
      return prisma.organization.findUnique({
        where: { id: input.orgId },
        select: {
          name: true,
          country: true,
          sicCode: true,
          sicDescription: true,
          status: true,
          companyId: true,
          authCode: true,
          confirmationStatementDue: true,
          accountsFilingDue: true,
          stateFilingDue: true,
          federalFilingDue: true,
          stateTaxDue: true,
          createdAt: true,
          directors: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              dateOfBirth: true,
              address: true,
            },
          },
          documents: {
            select: {
              id: true,
              name: true,
              value: true,
              status: true,
              rejectReason: true,
              requestReason: true,
              createdAt: true,
            },
          },
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
            },
          },
        },
      })
    }),

  getStats: adminProcedure.query(async () => {
    const [
      totalFormations,
      pendingFormations,
      processingFormations,
      completedFormations,
      docsToReview,
      processingInvoices,
      unpaidInvoices,
      pendingOrders,
      totalUsers,
      paidInvoices,
      recentFormations,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: CompanyStatus.pending } }),
      prisma.organization.count({ where: { status: CompanyStatus.processing } }),
      prisma.organization.count({ where: { status: CompanyStatus.completed } }),
      prisma.document.count({ where: { status: DocumentStatus.submitted } }),
      prisma.invoice.count({ where: { status: PaymentStatus.processing } }),
      prisma.invoice.count({ where: { status: PaymentStatus.unpaid } }),
      prisma.serviceOrder.count({ where: { status: "pending" } }),
      prisma.user.count(),
      prisma.invoice.findMany({
        where: { status: PaymentStatus.paid },
        select: { amount: true },
      }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          country: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    const revenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0)

    return {
      totalFormations,
      pendingFormations,
      processingFormations,
      completedFormations,
      docsToReview,
      processingInvoices,
      unpaidInvoices,
      pendingOrders,
      totalUsers,
      revenue,
      recentFormations,
    }
  }),

  listAll: adminProcedure.query(async () => {
    return prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        directors: {
          select: { id: true, firstName: true, lastName: true },
        },
        documents: {
          select: { id: true, name: true, status: true },
        },
        _count: { select: { invoices: true } },
      },
    })
  }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return prisma.organization.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          directors: true,
          documents: {
            orderBy: { createdAt: "desc" },
          },
          invoices: {
            orderBy: { createdAt: "desc" },
          },
        },
      })
    }),

  reviewDocument: adminProcedure
    .input(
      z.object({
        documentId: z.string(),
        status: z.enum(["approved", "rejected"]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const data: Record<string, unknown> = { status: input.status }
      if (input.status === "rejected" && input.reason) {
        data.rejectReason = input.reason
      }
      if (input.status === "approved") {
        data.rejectReason = null
      }
      return prisma.document.update({
        where: { id: input.documentId },
        data,
        select: { id: true, name: true, status: true, rejectReason: true },
      })
    }),

  updateCompanyDetails: adminProcedure
    .input(
      z.object({
        id: z.string(),
        companyId: z.string().optional(),
        authCode: z.string().optional(),
        confirmationStatementDue: z.string().nullable().optional(),
        accountsFilingDue: z.string().nullable().optional(),
        stateFilingDue: z.string().nullable().optional(),
        federalFilingDue: z.string().nullable().optional(),
        stateTaxDue: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const toDate = (v: string | null | undefined) =>
        v === undefined ? undefined : v ? new Date(v) : null
      return prisma.organization.update({
        where: { id: input.id },
        data: {
          ...(input.companyId !== undefined && { companyId: input.companyId }),
          ...(input.authCode !== undefined && { authCode: input.authCode }),
          ...(input.confirmationStatementDue !== undefined && {
            confirmationStatementDue: toDate(input.confirmationStatementDue),
          }),
          ...(input.accountsFilingDue !== undefined && {
            accountsFilingDue: toDate(input.accountsFilingDue),
          }),
          ...(input.stateFilingDue !== undefined && {
            stateFilingDue: toDate(input.stateFilingDue),
          }),
          ...(input.federalFilingDue !== undefined && {
            federalFilingDue: toDate(input.federalFilingDue),
          }),
          ...(input.stateTaxDue !== undefined && {
            stateTaxDue: toDate(input.stateTaxDue),
          }),
        },
      })
    }),

  updateStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(CompanyStatus) }))
    .mutation(async ({ input }) => {
      return prisma.organization.update({
        where: { id: input.id },
        data: { status: input.status },
      })
    }),

  requestDocument: adminProcedure
    .input(z.object({ organizationId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return prisma.document.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          status: DocumentStatus.requested,
        },
      })
    }),
})
