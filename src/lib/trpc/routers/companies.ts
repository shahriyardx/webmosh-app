import { z } from "zod"
import { adminProcedure, assertOrgMember, protectedProcedure, router } from "../server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import {
  AccountStatus,
  CompanyStatus,
  DocumentStatus,
  PaymentStatus,
} from "@/generated/prisma/enums"
import {
  emailAdminNewFormation,
  emailAdminDocumentResubmitted,
  emailUserDocumentRequested,
  emailUserDocumentReviewed,
  emailUserStatusUpdate,
  emailUserCompanyCompleted,
} from "@/lib/notify"
import { createAdminNotification } from "@/lib/notifications"
import { getCompaniesHouseProfile, getCompaniesHouseDates } from "@/lib/companies-house"
import { purchaseServiceCore, wordpressInputSchema } from "./service-orders"

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
  wordpressOrders: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        wordpress: wordpressInputSchema,
      }),
    )
    .optional(),
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

/**
 * Enrich orgs with live Companies House data (incorporation date, status,
 * filing dues) and the latest website (WordPress) order status. DB dues
 * override CH values.
 */
async function enrichCompanies<
  T extends {
    id: string
    country: string | null
    companyId: string | null
    confirmationStatementDue: Date | null
    accountsFilingDue: Date | null
  },
>(orgs: T[]) {
  const orgIds = orgs.map((o) => o.id)
  const wpOrders = orgIds.length
    ? await prisma.serviceOrder.findMany({
        where: {
          organizationId: { in: orgIds },
          service: { type: "wordpress" },
        },
        orderBy: { createdAt: "desc" },
        select: { organizationId: true, status: true },
      })
    : []
  const websiteByOrg = new Map<string, string>()
  for (const o of wpOrders) {
    if (!websiteByOrg.has(o.organizationId)) {
      websiteByOrg.set(o.organizationId, o.status)
    }
  }

  // Latest RDP host per company (for the admin's client company list).
  const rdpOrders = orgIds.length
    ? await prisma.serviceOrder.findMany({
        where: { organizationId: { in: orgIds }, rdpHost: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { organizationId: true, rdpHost: true },
      })
    : []
  const rdpByOrg = new Map<string, string>()
  for (const o of rdpOrders) {
    if (o.rdpHost && !rdpByOrg.has(o.organizationId)) {
      rdpByOrg.set(o.organizationId, o.rdpHost)
    }
  }

  return Promise.all(
    orgs.map(async (o) => {
      const base = {
        ...o,
        incorporationDate: null as Date | null,
        chStatus: null as string | null,
        websiteStatus: websiteByOrg.get(o.id) ?? null,
        rdpHost: rdpByOrg.get(o.id) ?? null,
      }
      if (o.country !== "uk" || !o.companyId) return base
      const dates = await getCompaniesHouseDates(o.companyId).catch(() => null)
      if (!dates) return base
      return {
        ...base,
        confirmationStatementDue:
          o.confirmationStatementDue ??
          (dates.confirmationNextDue
            ? new Date(dates.confirmationNextDue)
            : null),
        accountsFilingDue:
          o.accountsFilingDue ??
          (dates.accountsNextDue ? new Date(dates.accountsNextDue) : null),
        incorporationDate: dates.incorporationDate
          ? new Date(dates.incorporationDate)
          : null,
        chStatus: dates.status,
      }
    }),
  )
}

/** Shared: the enriched company list for a given user (self or, for admins, a client). */
async function listCompaniesForUser(userId: string) {
  const members = await prisma.member.findMany({
    where: { userId, organization: { deletedAt: null } },
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
          stripeStatus: true,
          wiseStatus: true,
          websiteStatusOverride: true,
        },
      },
    },
  })
  return enrichCompanies(members.map((m) => m.organization))
}

export const companiesRouter = router({
  /** Minimal profile lookup used for form auto-fill. */
  myProfile: protectedProcedure.query(({ ctx }) =>
    prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { name: true, email: true, phone: true, address: true },
    }),
  ),

  /** Director contact for a company the caller belongs to (for prefills). */
  directorContact: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOrgMember(ctx.user.id, input.organizationId)
      const director = await prisma.director.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "asc" },
        select: { email: true, phone: true, address: true },
      })
      return {
        email: director?.email ?? "",
        phone: director?.phone ?? "",
        address: director?.address ?? "",
      }
    }),

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
        wordpressOrders,
        passportUrl,
        bankStatementUrl,
        director,
      } = input

      // WordPress services are billed as their own separate orders (with their
      // own requirements + invoice), so keep them out of the formation bundle.
      const wpServiceIds = new Set(
        (wordpressOrders ?? []).map((o) => o.serviceId),
      )
      const bundledServiceIds = serviceIds.filter((id) => !wpServiceIds.has(id))

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
          serviceIds: bundledServiceIds,
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
      const selectedSvcs = bundledServiceIds.length > 0
        ? await prisma.service.findMany({ where: { id: { in: bundledServiceIds } } })
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
      await createAdminNotification({
        kind: "formation.created",
        title: `New formation: ${companyName}`,
        body: `${country.toUpperCase()} company registration requested.`,
        link: `/admin/formations/${org.id}`,
      })

      // Spin off a separate service order (+ its own invoice) for each
      // WordPress service configured during onboarding.
      for (const wo of wordpressOrders ?? []) {
        await purchaseServiceCore({
          organizationId: org.id,
          serviceId: wo.serviceId,
          wordpress: wo.wordpress,
        })
      }

      return org
    }),

  importCompany: protectedProcedure
    .input(
      z.object({
        companyId: z.string().min(1),
        authCode: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const companyId = input.companyId.trim()
      const authCode = input.authCode.trim()

      // Idempotency: if this user already imported this company (e.g. a first
      // attempt succeeded but the response never reached the client and the
      // screen appeared to freeze), just return the existing org so the client
      // navigates into it instead of erroring on the unique slug.
      const already = await prisma.member.findFirst({
        where: {
          userId: ctx.user.id,
          organization: { companyId, deletedAt: null },
        },
        select: { organizationId: true },
      })
      if (already) return { id: already.organizationId }

      const profile = await getCompaniesHouseProfile(companyId)
      if (!profile || !profile.name) {
        throw new Error(
          "Couldn't reach Companies House for that Company ID. Check the ID and try again.",
        )
      }

      // Organization.slug is globally unique — make sure ours won't collide
      // (e.g. two companies with the same name, or a retry).
      const base = slugify(profile.name) || slugify(companyId)
      let slug = base
      for (let i = 0; i < 6; i++) {
        const taken = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })
        if (!taken) break
        slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
      }

      const hdrs = await headers()
      const org = await auth.api.createOrganization({
        body: { name: profile.name, slug },
        headers: hdrs,
      })

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          country: "uk",
          companyId,
          authCode,
          sicCode: profile.sicCodes[0] ?? null,
          status: CompanyStatus.completed,
        },
      })

      await createAdminNotification({
        kind: "formation.imported",
        title: `Company imported: ${profile.name}`,
        body: `UK company ${companyId} linked by client.`,
        link: `/admin/formations/${org.id}`,
      })

      return { id: org.id }
    }),

  // Import an existing US LLC. There is no public US registry API, so all
  // details are entered manually and supporting documents are uploaded.
  importUsCompany: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        companyNumber: z.string().optional(),
        state: z.string().min(1),
        registeredAddress: z.string().min(1),
        ein: z.string().optional(),
        director: z.object({
          name: z.string().min(1),
          dateOfBirth: z.string().min(1),
        }),
        certificateUrl: z.string().min(1),
        articlesUrl: z.string().min(1),
        einLetterUrl: z.string().min(1),
        passportUrl: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const name = input.companyName.trim()

      // Organization.slug is globally unique — avoid collisions on retries or
      // duplicate names.
      const base = slugify(name) || slugify(input.companyNumber ?? "us-company")
      let slug = base
      for (let i = 0; i < 6; i++) {
        const taken = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })
        if (!taken) break
        slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
      }

      const hdrs = await headers()
      const org = await auth.api.createOrganization({
        body: { name, slug },
        headers: hdrs,
      })

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          country: "us",
          companyId: input.companyNumber?.trim() || null,
          state: input.state.trim(),
          registeredAddress: input.registeredAddress.trim(),
          ein: input.ein?.trim() || null,
          status: CompanyStatus.completed,
        },
      })

      // Split the director's full name into first / last for the Director model.
      const parts = input.director.name.trim().split(/\s+/)
      const firstName = parts[0] ?? input.director.name.trim()
      const lastName = parts.slice(1).join(" ") || firstName
      await prisma.director.create({
        data: {
          organizationId: org.id,
          firstName,
          lastName,
          email: "",
          phone: "",
          dateOfBirth: input.director.dateOfBirth.trim(),
          address: input.registeredAddress.trim(),
        },
      })

      await prisma.document.createMany({
        data: [
          {
            name: "Certificate of Incorporation",
            value: input.certificateUrl,
            status: DocumentStatus.submitted,
            organizationId: org.id,
          },
          {
            name: "Articles of Organization",
            value: input.articlesUrl,
            status: DocumentStatus.submitted,
            organizationId: org.id,
          },
          {
            name: "EIN Letter",
            value: input.einLetterUrl,
            status: DocumentStatus.submitted,
            organizationId: org.id,
          },
          {
            name: "Director Passport",
            value: input.passportUrl,
            status: DocumentStatus.submitted,
            organizationId: org.id,
          },
        ],
      })

      await createAdminNotification({
        kind: "formation.imported",
        title: `Company imported: ${name}`,
        body: `US LLC (${input.state.trim()}) linked by client.`,
        link: `/admin/formations/${org.id}`,
      })

      return { id: org.id }
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
      await createAdminNotification({
        kind: "document.submitted",
        title: `Document uploaded: ${updated.name}`,
        body: `${org?.name ?? "A customer"} submitted a document for review.`,
        link: `/admin/formations/${input.organizationId}`,
      })

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
          serviceOrders: {
            where: { rdpHost: { not: null } },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              rdpHost: true,
              rdpUsername: true,
              rdpPassword: true,
              rdpPort: true,
              service: { select: { title: true } },
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
          serviceOrders: {
            where: { rdpHost: { not: null } },
            orderBy: { createdAt: "desc" },
            include: { service: { select: { title: true } } },
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
  myCompanies: protectedProcedure.query(({ ctx }) =>
    listCompaniesForUser(ctx.user.id),
  ),

  /** Admin: same enriched company list as the user sees, for a given client. */
  adminCompaniesForUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => listCompaniesForUser(input.userId)),

  /** Admin: set a company's Stripe, Wise, or Website account status. */
  setAccountStatus: adminProcedure
    .input(
      z.object({
        organizationId: z.string(),
        field: z.enum(["stripe", "wise", "website"]),
        // "auto" clears a Website override so it follows the order again.
        status: z.union([z.nativeEnum(AccountStatus), z.literal("auto")]),
      }),
    )
    .mutation(async ({ input }) => {
      const { organizationId, field, status } = input
      if (field === "website") {
        return prisma.organization.update({
          where: { id: organizationId },
          data: {
            websiteStatusOverride: status === "auto" ? null : status,
          },
          select: { id: true, websiteStatusOverride: true },
        })
      }
      if (status === "auto") throw new Error("Invalid status")
      return prisma.organization.update({
        where: { id: organizationId },
        data:
          field === "stripe"
            ? { stripeStatus: status }
            : { wiseStatus: status },
        select: { id: true, stripeStatus: true, wiseStatus: true },
      })
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
