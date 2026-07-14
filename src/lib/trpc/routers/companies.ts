import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { CompanyStatus, DocumentStatus, PaymentStatus } from "@/generated/prisma/enums"
import {
  emailAdminNewFormation,
  emailAdminDocumentResubmitted,
  emailUserDocumentRequested,
  emailUserDocumentReviewed,
  emailUserStatusUpdate,
  emailUserCompanyCompleted,
} from "@/lib/notify"
import { getCompaniesHouseProfile, getCompaniesHouseDates } from "@/lib/companies-house"

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
  website: z.string().optional(),
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
        website,
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
          website: website || null,
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

      await emailAdminNewFormation(org.id, companyName, country).catch(() => {})

      return org
    }),

  importCompany: protectedProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        authCode: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const profile = await getCompaniesHouseProfile(input.companyId.trim())
      if (!profile || !profile.name) {
        throw new Error("Company not found on Companies House. Check the Company ID.")
      }

      const slug = slugify(profile.name) || slugify(input.companyId)
      const hdrs = await headers()

      const org = await auth.api.createOrganization({
        body: { name: profile.name, slug },
        headers: hdrs,
      })

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          country: "uk",
          companyId: input.companyId.trim(),
          authCode: input.authCode.trim(),
          sicCode: profile.sicCodes[0] ?? null,
          status: CompanyStatus.completed,
        },
      })

      return org
    }),

  hasPersonalCompany: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.member.count({
      where: {
        userId: ctx.user.id,
        organization: { type: "personal", deletedAt: null },
      },
    })
    return count > 0
  }),

  createPersonalCompany: protectedProcedure.mutation(async ({ ctx }) => {
    // Prevent a second personal account
    const existing = await prisma.member.count({
      where: {
        userId: ctx.user.id,
        organization: { type: "personal", deletedAt: null },
      },
    })
    if (existing > 0) throw new Error("You already have a personal account")

    const name = ctx.user.name?.trim() || "My Account"
    const slug = `${slugify(name) || "account"}-${ctx.user.id.slice(-6)}`
    const hdrs = await headers()

    const org = await auth.api.createOrganization({
      body: { name, slug },
      headers: hdrs,
    })

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        country: "uk",
        type: "personal",
        status: CompanyStatus.completed,
      },
    })

    return org
  }),

  submitDocument: protectedProcedure
    .input(z.object({ organizationId: z.string(), documentId: z.string(), fileUrl: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)

      const doc = await prisma.document.findFirst({
        where: { id: input.documentId, organizationId: input.organizationId },
      })
      if (!doc) throw new Error("Document not found")

      const updated = await prisma.document.update({
        where: { id: input.documentId },
        data: { value: input.fileUrl, status: DocumentStatus.submitted },
        select: { id: true, name: true, value: true, status: true, createdAt: true, rejectReason: true },
      })

      const org = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      })
      await emailAdminDocumentResubmitted(input.organizationId, updated.name, org?.name ?? "a company").catch(() => {})

      return updated
    }),

  getPendingDocCount: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      return prisma.document.count({
        where: {
          organizationId: input.organizationId,
          status: { in: [DocumentStatus.requested, DocumentStatus.rejected] },
        },
      })
    }),

  documentsForUser: protectedProcedure.query(async ({ ctx }) => {
    const members = await prisma.member.findMany({
      where: { userId: ctx.user.id, organization: { deletedAt: null } },
      select: { organizationId: true },
    })
    const orgIds = members.map((m) => m.organizationId)
    if (!orgIds.length) return []
    const [docs, orgs] = await Promise.all([
      prisma.document.findMany({
        where: { organizationId: { in: orgIds } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      }),
    ])
    const orgMap = new Map(orgs.map((o) => [o.id, o]))
    return docs.map((d) => ({ ...d, organization: orgMap.get(d.organizationId) ?? null }))
  }),

  pendingDocCountForUser: protectedProcedure.query(async ({ ctx }) => {
    const members = await prisma.member.findMany({
      where: { userId: ctx.user.id, organization: { deletedAt: null } },
      select: { organizationId: true },
    })
    const orgIds = members.map((m) => m.organizationId)
    if (!orgIds.length) return 0
    return prisma.document.count({
      where: {
        organizationId: { in: orgIds },
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
      return prisma.organization.findFirst({
        where: { id: input.orgId, deletedAt: null },
        select: {
          name: true,
          country: true,
          sicCode: true,
          sicDescription: true,
          website: true,
          status: true,
          type: true,
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

  companiesHouse: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ input, ctx }) => {
      const org = await prisma.organization.findFirst({
        where: { id: input.orgId, deletedAt: null },
        select: { companyId: true, authCode: true, country: true, status: true, name: true },
      })
      if (!org || org.country !== "uk" || !org.companyId) return null

      // Access: admin, or a member of the org
      const isAdmin = ctx.user.role === "admin"
      if (!isAdmin) {
        const member = await prisma.member.findFirst({
          where: { organizationId: input.orgId, userId: ctx.user.id },
          select: { id: true },
        })
        if (!member) return null
      }

      const profile = await getCompaniesHouseProfile(org.companyId)
      if (!profile) return null
      return {
        ...profile,
        authCode: org.authCode,
        internalStatus: org.status as string,
        localName: org.name,
      }
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
      prisma.organization.count({ where: { deletedAt: null } }),
      prisma.organization.count({ where: { deletedAt: null, status: CompanyStatus.pending } }),
      prisma.organization.count({ where: { deletedAt: null, status: CompanyStatus.processing } }),
      prisma.organization.count({ where: { deletedAt: null, status: CompanyStatus.completed } }),
      prisma.document.count({ where: { status: DocumentStatus.submitted } }),
      prisma.invoice.count({ where: { status: PaymentStatus.processing, deletedAt: null } }),
      prisma.invoice.count({ where: { status: PaymentStatus.unpaid, deletedAt: null } }),
      prisma.serviceOrder.count({ where: { status: "pending" } }),
      prisma.user.count(),
      prisma.invoice.findMany({
        where: { status: PaymentStatus.paid, deletedAt: null },
        select: { amount: true },
      }),
      prisma.organization.findMany({
        where: { deletedAt: null },
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
      where: { deletedAt: null },
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
            where: { deletedAt: null },
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
      const updated = await prisma.document.update({
        where: { id: input.documentId },
        data,
        select: { id: true, name: true, status: true, rejectReason: true, organizationId: true },
      })
      await emailUserDocumentReviewed(
        updated.organizationId,
        updated.name,
        input.status === "approved",
        input.reason,
      ).catch(() => {})
      return updated
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
      const updated = await prisma.organization.update({
        where: { id: input.id },
        data: { status: input.status },
      })
      if (input.status === CompanyStatus.completed) {
        await emailUserCompanyCompleted(input.id).catch(() => {})
      } else {
        await emailUserStatusUpdate(input.id, input.status).catch(() => {})
      }
      return updated
    }),

  requestDocument: adminProcedure
    .input(z.object({ organizationId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const doc = await prisma.document.create({
        data: {
          organizationId: input.organizationId,
          name: input.name,
          status: DocumentStatus.requested,
        },
      })
      await emailUserDocumentRequested(input.organizationId, input.name).catch(() => {})
      return doc
    }),

  // User's own non-deleted companies (for the Companies list page)
  myCompanies: protectedProcedure.query(async ({ ctx }) => {
    const members = await prisma.member.findMany({
      where: { userId: ctx.user.id, organization: { deletedAt: null } },
      select: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            type: true,
            country: true,
            status: true,
            companyId: true,
            createdAt: true,
            confirmationStatementDue: true,
            accountsFilingDue: true,
          },
        },
      },
    })
    const orgs = members.map((m) => m.organization)

    // Enrich UK companies with live Companies House filing dates (1h fetch cache).
    // DB overrides win; otherwise fall back to what CH reports.
    const enriched = await Promise.all(
      orgs.map(async (o) => {
        if (o.country !== "uk" || !o.companyId) return o
        if (o.confirmationStatementDue && o.accountsFilingDue) return o
        const dates = await getCompaniesHouseDates(o.companyId).catch(() => null)
        if (!dates) return o
        return {
          ...o,
          confirmationStatementDue:
            o.confirmationStatementDue ??
            (dates.confirmationNextDue ? new Date(dates.confirmationNextDue) : null),
          accountsFilingDue:
            o.accountsFilingDue ??
            (dates.accountsNextDue ? new Date(dates.accountsNextDue) : null),
        }
      }),
    )
    return enriched
  }),

  // User soft-deletes their own company; reassigns active org
  deleteCompany: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { organizationId: input.id, userId: ctx.user.id },
        select: { id: true },
      })
      if (!member) throw new Error("Forbidden")

      await prisma.organization.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })

      const next = await prisma.member.findFirst({
        where: {
          userId: ctx.user.id,
          organizationId: { not: input.id },
          organization: { deletedAt: null },
        },
        select: { organizationId: true },
        orderBy: { createdAt: "desc" },
      })

      return { nextActiveOrgId: next?.organizationId ?? null }
    }),

  // Admin soft-deletes a formation
  deleteFormation: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.organization.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),

  // Admin: list soft-deleted formations (trash)
  listDeleted: adminProcedure.query(async () => {
    return prisma.organization.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { invoices: true, documents: true } },
      },
    })
  }),

  // Admin: restore a soft-deleted formation
  restoreFormation: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return prisma.organization.update({
        where: { id: input.id },
        data: { deletedAt: null },
      })
    }),

  // Admin: permanently delete a formation and everything linked to it
  purgeFormation: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Tickets link with SetNull, so remove them explicitly (messages cascade)
      await prisma.ticket.deleteMany({ where: { organizationId: input.id } })
      // Directors, documents, invoices, serviceOrders, mails, members, invitations
      // all cascade on organization delete
      await prisma.organization.delete({ where: { id: input.id } })
      return { ok: true }
    }),
})
