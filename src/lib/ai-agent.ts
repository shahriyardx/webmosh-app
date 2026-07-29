import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { decryptSecret } from "@/lib/crypto"
import { logAudit } from "@/lib/audit"
import type { Prisma } from "@/generated/prisma/client"
import {
  ServiceOrderStatus,
  PaymentStatus,
  TicketStatus,
  CompanyStatus,
  CouponDiscountType,
} from "@/generated/prisma/enums"
import type { createTRPCContext } from "@/lib/trpc/server"

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>
export type AgentUser = NonNullable<Ctx["user"]>

const KEY_NAME = "anthropic_api_key"
const MODEL_KEY_NAME = "ai_model"
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"

// Selectable models (admin picks one in Settings). Both support vision + PDF,
// so either handles chat commands and document extraction.
export const AI_MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    hint: "Default — faster & cheaper",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    hint: "Stronger reasoning, higher cost",
  },
] as const
export type AiModel = (typeof AI_MODELS)[number]["id"]
// Haiku is the default (cheapest); Sonnet is reserved for image/PDF extraction.
export const DEFAULT_MODEL: AiModel = "claude-haiku-4-5"
const STRONG_MODEL: AiModel = "claude-sonnet-5"
const MODEL_IDS = AI_MODELS.map((m) => m.id) as readonly string[]

// Valid enum values, sourced from the Prisma schema (never hardcoded here).
const ORDER_STATUSES = Object.values(ServiceOrderStatus) as string[]
const PAYMENT_STATUSES = Object.values(PaymentStatus) as string[]
const TICKET_STATUSES = Object.values(TicketStatus) as string[]
const COMPANY_STATUSES = Object.values(CompanyStatus) as string[]
const COUPON_TYPES = Object.values(CouponDiscountType) as string[]

// Resolve the model to use at request time: DB setting (admin selection) wins,
// then ANTHROPIC_MODEL env override, then the default. Never hardcoded.
export async function getModel(): Promise<string> {
  const row = await prisma.integrationSetting.findUnique({
    where: { keyName: MODEL_KEY_NAME },
  })
  if (row?.encryptedValue && MODEL_IDS.includes(row.encryptedValue)) {
    return row.encryptedValue
  }
  const envModel = process.env.ANTHROPIC_MODEL
  if (envModel) return envModel
  return DEFAULT_MODEL
}

/** Persist the admin's model choice. Validated against the allowlist. */
export async function setModel(
  model: string,
  updatedById: string,
): Promise<void> {
  if (!MODEL_IDS.includes(model)) {
    throw new Error("Unsupported model.")
  }
  await prisma.integrationSetting.upsert({
    where: { keyName: MODEL_KEY_NAME },
    create: { keyName: MODEL_KEY_NAME, encryptedValue: model, updatedById },
    update: { encryptedValue: model, updatedById },
  })
}

// ---------------------------------------------------------------------------
// Key resolution: DB (encrypted) takes priority, else ANTHROPIC_API_KEY env.
// ---------------------------------------------------------------------------
export async function getAnthropicKey(): Promise<string | null> {
  const row = await prisma.integrationSetting.findUnique({
    where: { keyName: KEY_NAME },
  })
  if (row?.encryptedValue) {
    try {
      return decryptSecret(row.encryptedValue)
    } catch {
      // Corrupt blob or wrong SETTINGS_ENCRYPTION_KEY — fall through to env.
    }
  }
  return process.env.ANTHROPIC_API_KEY || null
}

// ---------------------------------------------------------------------------
// Tool schemas (Anthropic tool-use format: name + description + input_schema).
// Read/list tools run automatically; every mutating tool is in CONFIRM_TOOLS.
// ---------------------------------------------------------------------------
export const TOOLS = [
  // ----- Services -----
  {
    name: "list_services",
    description:
      "List every service in the catalog with id, title, price, type and country.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_service",
    description: "Create a new service. Requires admin confirmation before it runs.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Service title." },
        price: { type: "number", description: "Price in USD." },
        description: { type: "string" },
        country: {
          type: "string",
          enum: ["us", "uk", "any"],
          description: "Country the service is for, or 'any'.",
        },
        type: { type: "string", enum: ["general", "wordpress"] },
        features: { type: "array", items: { type: "string" } },
      },
      required: ["name", "price"],
    },
  },
  {
    name: "modify_service",
    description: "Update fields of an existing service. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string" },
        changes: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            description: { type: "string" },
            country: { type: "string", enum: ["us", "uk", "any"] },
            type: { type: "string", enum: ["general", "wordpress"] },
          },
        },
      },
      required: ["service_id", "changes"],
    },
  },
  {
    name: "delete_service",
    description: "Delete a service by id. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { service_id: { type: "string" } },
      required: ["service_id"],
    },
  },

  // ----- Service orders -----
  {
    name: "list_orders",
    description:
      "List service orders, optionally filtered by status. Omit status to list all orders.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ORDER_STATUSES,
          description: "Optional status filter.",
        },
      },
    },
  },
  {
    name: "get_order",
    description: "Get details of a single service order by id.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
    },
  },
  {
    name: "update_order_status",
    description: "Change an order's status. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        status: { type: "string", enum: ORDER_STATUSES },
      },
      required: ["order_id", "status"],
    },
  },
  {
    name: "edit_order",
    description:
      "Edit an order's fields (status, amount, contact details, RDP access). Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        status: { type: "string", enum: ORDER_STATUSES },
        amount: { type: "number", description: "New invoice amount in USD." },
        contact_company: { type: "string" },
        contact_email: { type: "string" },
        contact_phone: { type: "string" },
        contact_address: { type: "string" },
        rdp_host: { type: "string" },
        rdp_username: { type: "string" },
        rdp_password: { type: "string" },
        rdp_port: { type: "string" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "delete_order",
    description:
      "Delete an order, optionally deleting its linked invoice too. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        delete_invoice: { type: "boolean" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "quote_order",
    description:
      "Issue a quoted invoice for a custom order that is awaiting a quote. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        amount: { type: "number", description: "Quote amount in USD." },
        description: { type: "string" },
      },
      required: ["order_id", "amount"],
    },
  },

  // ----- Invoices -----
  {
    name: "list_invoices",
    description:
      "List invoices, optionally filtered by payment status. Omit status to list all.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: PAYMENT_STATUSES },
      },
    },
  },
  {
    name: "approve_invoice",
    description:
      "Approve a submitted invoice payment (marks it paid). Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { invoice_id: { type: "string" } },
      required: ["invoice_id"],
    },
  },
  {
    name: "reject_invoice",
    description:
      "Reject an invoice payment with a reason. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        invoice_id: { type: "string" },
        reason: { type: "string" },
      },
      required: ["invoice_id", "reason"],
    },
  },
  {
    name: "send_invoice_reminder",
    description:
      "Email the client a reminder for an unpaid invoice. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { invoice_id: { type: "string" } },
      required: ["invoice_id"],
    },
  },
  {
    name: "create_invoice",
    description:
      "Create an invoice for a company/organization. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        company_id: {
          type: "string",
          description: "Organization/company id to bill.",
        },
        amount: { type: "number", description: "Amount in USD." },
        description: { type: "string" },
      },
      required: ["company_id", "amount"],
    },
  },
  {
    name: "delete_invoice",
    description: "Delete an invoice by id. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { invoice_id: { type: "string" } },
      required: ["invoice_id"],
    },
  },

  // ----- Clients -----
  {
    name: "list_clients",
    description: "List all clients with their companies.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_client",
    description: "Get a single client's full profile by user id.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "update_client",
    description:
      "Update a client's basic details (name, email, phone, address). Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "suspend_client",
    description:
      "Suspend or un-suspend a client account. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        suspended: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["client_id", "suspended"],
    },
  },
  {
    name: "delete_client",
    description:
      "Permanently delete a client and their solo organizations. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },

  // ----- Companies / formations -----
  {
    name: "list_companies",
    description: "List all companies/formations with their status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_company",
    description: "Get a single company/formation by id.",
    input_schema: {
      type: "object",
      properties: { company_id: { type: "string" } },
      required: ["company_id"],
    },
  },
  {
    name: "update_company_status",
    description:
      "Change a company/formation's status. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string" },
        status: { type: "string", enum: COMPANY_STATUSES },
      },
      required: ["company_id", "status"],
    },
  },
  {
    name: "review_document",
    description:
      "Approve or reject a submitted company document. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        document_id: { type: "string" },
        status: { type: "string", enum: ["approved", "rejected"] },
        reason: { type: "string" },
      },
      required: ["document_id", "status"],
    },
  },
  {
    name: "request_document",
    description:
      "Request a named document from a company/organization. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string" },
        name: { type: "string", description: "Name of the document to request." },
      },
      required: ["company_id", "name"],
    },
  },

  // ----- Support tickets -----
  {
    name: "list_tickets",
    description:
      "List support tickets, optionally filtered by status. Omit status to list all.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: TICKET_STATUSES },
      },
    },
  },
  {
    name: "set_ticket_status",
    description: "Change a support ticket's status. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        ticket_id: { type: "string" },
        status: { type: "string", enum: TICKET_STATUSES },
      },
      required: ["ticket_id", "status"],
    },
  },

  // ----- Packages -----
  {
    name: "list_packages",
    description: "List all formation packages.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_package",
    description: "Create a formation package. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        country: { type: "string", enum: ["us", "uk"] },
        features: { type: "array", items: { type: "string" } },
        price: { type: "number" },
      },
      required: ["title", "description", "country", "features", "price"],
    },
  },
  {
    name: "update_package",
    description: "Update a formation package. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        package_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        country: { type: "string", enum: ["us", "uk"] },
        features: { type: "array", items: { type: "string" } },
        price: { type: "number" },
      },
      required: ["package_id"],
    },
  },
  {
    name: "delete_package",
    description: "Delete a formation package by id. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { package_id: { type: "string" } },
      required: ["package_id"],
    },
  },

  // ----- Coupons -----
  {
    name: "list_coupons",
    description: "List all discount coupons.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_coupon",
    description: "Create a discount coupon. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string" },
        discount_type: { type: "string", enum: COUPON_TYPES },
        discount_value: {
          type: "number",
          description: "Percent (for percent type) or USD amount (for fixed).",
        },
        description: { type: "string" },
        enabled: { type: "boolean" },
        min_subtotal: { type: "number" },
        max_discount: { type: "number" },
      },
      required: ["code", "discount_type", "discount_value"],
    },
  },
  {
    name: "set_coupon_enabled",
    description: "Enable or disable a coupon. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        coupon_id: { type: "string" },
        enabled: { type: "boolean" },
      },
      required: ["coupon_id", "enabled"],
    },
  },
  {
    name: "delete_coupon",
    description: "Delete a coupon by id. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: { coupon_id: { type: "string" } },
      required: ["coupon_id"],
    },
  },

  // ----- Finance: payouts & wallet -----
  {
    name: "approve_payout",
    description:
      "Approve a freelancer payout request. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        payout_id: { type: "string" },
        note: { type: "string" },
      },
      required: ["payout_id"],
    },
  },
  {
    name: "reject_payout",
    description:
      "Reject a freelancer payout request. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        payout_id: { type: "string" },
        note: { type: "string" },
      },
      required: ["payout_id"],
    },
  },
  {
    name: "adjust_wallet",
    description:
      "Add or remove funds from a client's wallet balance. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        direction: { type: "string", enum: ["add", "remove"] },
        amount: { type: "number" },
        note: { type: "string" },
      },
      required: ["client_id", "direction", "amount"],
    },
  },
  {
    name: "approve_wallet_payment",
    description:
      "Approve a pending wallet transaction (e.g. a top-up or payout). Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        wallet_tx_id: { type: "string" },
        note: { type: "string" },
      },
      required: ["wallet_tx_id"],
    },
  },
  {
    name: "reject_wallet_payment",
    description:
      "Reject a pending wallet transaction. Requires confirmation.",
    input_schema: {
      type: "object",
      properties: {
        wallet_tx_id: { type: "string" },
        note: { type: "string" },
      },
      required: ["wallet_tx_id"],
    },
  },

  // ----- Dashboard -----
  {
    name: "dashboard_summary",
    description:
      "Get counts of items needing admin attention (pending orders, tickets, invoices, payouts, etc.).",
    input_schema: { type: "object", properties: {} },
  },

  // ----- Document extraction -----
  {
    name: "save_extracted_document",
    description:
      "Save structured data extracted from an attached image or PDF. ALWAYS call this after reading an attached invoice, ID document, or transaction/payment screenshot. Requires admin confirmation before the row is written — do NOT guess or fabricate values, leave anything you can't read as null. For an invoice extract vendor, amount, currency, date, invoice_number; for an id_document extract name, id_number, doc_type, expiry; for a transaction extract amount, date, sender, recipient, reference.",
    input_schema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["invoice", "id_document", "transaction", "other"],
        },
        fields: {
          type: "object",
          description: "The extracted structured fields for this document kind.",
        },
        summary: {
          type: "string",
          description: "A one-line human-readable summary of the document.",
        },
        order_id: {
          type: "string",
          description: "Related service order id, only if the admin gave one.",
        },
        company_id: { type: "string", description: "Related company/org id, if known." },
        client_id: { type: "string", description: "Related client id, if known." },
      },
      required: ["kind", "fields"],
    },
  },
] as const

/** Tools that mutate data / touch money / send email / store sensitive data —
 *  never auto-run; require explicit admin confirmation. */
const CONFIRM_TOOLS = new Set<string>([
  "add_service",
  "modify_service",
  "delete_service",
  "update_order_status",
  "edit_order",
  "delete_order",
  "quote_order",
  "approve_invoice",
  "reject_invoice",
  "send_invoice_reminder",
  "create_invoice",
  "delete_invoice",
  "update_client",
  "suspend_client",
  "delete_client",
  "update_company_status",
  "review_document",
  "request_document",
  "set_ticket_status",
  "create_package",
  "update_package",
  "delete_package",
  "create_coupon",
  "set_coupon_enabled",
  "delete_coupon",
  "approve_payout",
  "reject_payout",
  "adjust_wallet",
  "approve_wallet_payment",
  "reject_wallet_payment",
  "save_extracted_document",
])

// ---------------------------------------------------------------------------
// Server-side argument validation (treat tool inputs as untrusted).
// ---------------------------------------------------------------------------
const argSchemas: Record<string, z.ZodTypeAny> = {
  // Read
  list_services: z.object({}).passthrough(),
  list_orders: z.object({ status: z.nativeEnum(ServiceOrderStatus).optional() }),
  get_order: z.object({ order_id: z.string().min(1) }),
  list_invoices: z.object({ status: z.nativeEnum(PaymentStatus).optional() }),
  list_clients: z.object({}).passthrough(),
  get_client: z.object({ client_id: z.string().min(1) }),
  list_companies: z.object({}).passthrough(),
  get_company: z.object({ company_id: z.string().min(1) }),
  list_tickets: z.object({ status: z.nativeEnum(TicketStatus).optional() }),
  list_packages: z.object({}).passthrough(),
  list_coupons: z.object({}).passthrough(),
  dashboard_summary: z.object({}).passthrough(),

  // Services
  add_service: z.object({
    name: z.string().min(1),
    price: z.coerce.number().nonnegative(),
    description: z.string().optional(),
    country: z.enum(["us", "uk", "any"]).optional(),
    type: z.enum(["general", "wordpress"]).optional(),
    features: z.array(z.string()).optional(),
  }),
  modify_service: z.object({
    service_id: z.string().min(1),
    changes: z.object({
      name: z.string().optional(),
      price: z.coerce.number().optional(),
      description: z.string().optional(),
      country: z.enum(["us", "uk", "any"]).optional(),
      type: z.enum(["general", "wordpress"]).optional(),
    }),
  }),
  delete_service: z.object({ service_id: z.string().min(1) }),

  // Orders
  update_order_status: z.object({
    order_id: z.string().min(1),
    status: z.nativeEnum(ServiceOrderStatus),
  }),
  edit_order: z.object({
    order_id: z.string().min(1),
    status: z.nativeEnum(ServiceOrderStatus).optional(),
    amount: z.coerce.number().nonnegative().optional(),
    contact_company: z.string().optional(),
    contact_email: z.string().optional(),
    contact_phone: z.string().optional(),
    contact_address: z.string().optional(),
    rdp_host: z.string().optional(),
    rdp_username: z.string().optional(),
    rdp_password: z.string().optional(),
    rdp_port: z.string().optional(),
  }),
  delete_order: z.object({
    order_id: z.string().min(1),
    delete_invoice: z.boolean().optional(),
  }),
  quote_order: z.object({
    order_id: z.string().min(1),
    amount: z.coerce.number().positive(),
    description: z.string().optional(),
  }),

  // Invoices
  approve_invoice: z.object({ invoice_id: z.string().min(1) }),
  reject_invoice: z.object({
    invoice_id: z.string().min(1),
    reason: z.string().min(1),
  }),
  send_invoice_reminder: z.object({ invoice_id: z.string().min(1) }),
  create_invoice: z.object({
    company_id: z.string().min(1),
    amount: z.coerce.number().positive(),
    description: z.string().optional(),
  }),
  delete_invoice: z.object({ invoice_id: z.string().min(1) }),

  // Clients
  update_client: z.object({
    client_id: z.string().min(1),
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  suspend_client: z.object({
    client_id: z.string().min(1),
    suspended: z.boolean(),
    reason: z.string().optional(),
  }),
  delete_client: z.object({ client_id: z.string().min(1) }),

  // Companies
  update_company_status: z.object({
    company_id: z.string().min(1),
    status: z.nativeEnum(CompanyStatus),
  }),
  review_document: z.object({
    document_id: z.string().min(1),
    status: z.enum(["approved", "rejected"]),
    reason: z.string().optional(),
  }),
  request_document: z.object({
    company_id: z.string().min(1),
    name: z.string().min(1),
  }),

  // Tickets
  set_ticket_status: z.object({
    ticket_id: z.string().min(1),
    status: z.nativeEnum(TicketStatus),
  }),

  // Packages
  create_package: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    country: z.enum(["us", "uk"]),
    features: z.array(z.string().min(1)).min(1),
    price: z.coerce.number().nonnegative(),
  }),
  update_package: z.object({
    package_id: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    country: z.enum(["us", "uk"]).optional(),
    features: z.array(z.string().min(1)).min(1).optional(),
    price: z.coerce.number().nonnegative().optional(),
  }),
  delete_package: z.object({ package_id: z.string().min(1) }),

  // Coupons
  create_coupon: z.object({
    code: z.string().min(2),
    discount_type: z.nativeEnum(CouponDiscountType),
    discount_value: z.coerce.number().positive(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    min_subtotal: z.coerce.number().positive().optional(),
    max_discount: z.coerce.number().positive().optional(),
  }),
  set_coupon_enabled: z.object({
    coupon_id: z.string().min(1),
    enabled: z.boolean(),
  }),
  delete_coupon: z.object({ coupon_id: z.string().min(1) }),

  // Finance
  approve_payout: z.object({
    payout_id: z.string().min(1),
    note: z.string().optional(),
  }),
  reject_payout: z.object({
    payout_id: z.string().min(1),
    note: z.string().optional(),
  }),
  adjust_wallet: z.object({
    client_id: z.string().min(1),
    direction: z.enum(["add", "remove"]),
    amount: z.coerce.number().positive(),
    note: z.string().optional(),
  }),
  approve_wallet_payment: z.object({
    wallet_tx_id: z.string().min(1),
    note: z.string().optional(),
  }),
  reject_wallet_payment: z.object({
    wallet_tx_id: z.string().min(1),
    note: z.string().optional(),
  }),

  // Extraction
  save_extracted_document: z.object({
    kind: z.enum(["invoice", "id_document", "transaction", "other"]),
    fields: z.record(z.string(), z.any()),
    summary: z.string().optional(),
    order_id: z.string().optional(),
    company_id: z.string().optional(),
    client_id: z.string().optional(),
  }),
}

function validateArgs(name: string, raw: unknown): Record<string, unknown> {
  const schema = argSchemas[name]
  if (!schema) throw new Error(`Unknown tool: ${name}`)
  return schema.parse(raw) as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Tool executors — call the EXISTING tRPC procedures via a server-side caller
// (reuses validation + side effects like status emails; no duplicated logic).
// ---------------------------------------------------------------------------
async function getCaller(user: AgentUser) {
  const { appRouter } = await import("@/lib/trpc/routers")
  return appRouter.createCaller({ session: null, user })
}

type AnyOrder = {
  id: string
  status: string
  service?: { title: string } | null
  organization?: { name: string } | null
  invoice?: { amount: number; number: number } | null
}

function summarizeOrder(o: AnyOrder) {
  return {
    id: o.id,
    service: o.service?.title ?? null,
    company: o.organization?.name ?? null,
    amount: o.invoice?.amount ?? null,
    status: o.status,
    invoiceNumber: o.invoice?.number ?? null,
  }
}

// Loose shapes for compact list mapping (real field names, tsc-safe casts).
type LooseInvoice = {
  id: string
  number?: number
  amount?: number
  status?: string
  description?: string | null
  organization?: { name?: string } | null
}
type LooseTicket = {
  id: string
  subject?: string
  status?: string
  user?: { name?: string | null; email?: string } | null
}
type LoosePackage = {
  id: string
  title?: string
  price?: number
  country?: string
}
type LooseCoupon = {
  id: string
  code?: string
  discountType?: string
  discountValue?: number
  enabled?: boolean
}
type LooseOrg = {
  id: string
  name?: string
  status?: string
  type?: string
  country?: string | null
}
type LooseClient = { id: string; name?: string | null; email?: string }

const CAP = 40
const emptyToNull = (v: unknown) =>
  v === undefined ? undefined : v === null || v === "" ? null : String(v)

async function execTool(
  name: string,
  args: Record<string, unknown>,
  user: AgentUser,
): Promise<unknown> {
  const caller = await getCaller(user)
  const a = args as Record<string, string | number | boolean | undefined> & {
    changes?: Record<string, string | number | undefined>
    features?: string[]
    fields?: Record<string, unknown>
  }

  switch (name) {
    // ----- Services -----
    case "list_services": {
      const s = await caller.services.list()
      return s.map((x) => ({
        id: x.id,
        title: x.title,
        price: x.price,
        type: x.type,
        country: x.country ?? "any",
        requiresRdp: x.requiresRdp,
      }))
    }
    case "add_service": {
      const created = await caller.services.create({
        title: String(a.name),
        description: String(a.description || a.name),
        features: a.features?.length ? a.features : ["Included"],
        price: Number(a.price),
        country: a.country && a.country !== "any" ? (a.country as "us" | "uk") : null,
        type: (a.type as "general" | "wordpress") ?? "general",
        requiresRdp: false,
      })
      return { id: created.id, title: created.title, price: created.price }
    }
    case "modify_service": {
      const c = a.changes ?? {}
      const updated = await caller.services.update({
        id: String(a.service_id),
        ...(c.name !== undefined ? { title: String(c.name) } : {}),
        ...(c.description !== undefined
          ? { description: String(c.description) }
          : {}),
        ...(c.price !== undefined ? { price: Number(c.price) } : {}),
        ...(c.type !== undefined
          ? { type: c.type as "general" | "wordpress" }
          : {}),
        ...(c.country !== undefined
          ? { country: c.country === "any" ? null : (c.country as "us" | "uk") }
          : {}),
      })
      return { id: updated.id, title: updated.title, price: updated.price }
    }
    case "delete_service": {
      await caller.services.delete({ id: String(a.service_id) })
      return { deleted: String(a.service_id) }
    }

    // ----- Orders -----
    case "list_orders": {
      const all = (await caller.serviceOrders.listAll()) as AnyOrder[]
      const filtered = a.status
        ? all.filter((o) => o.status === a.status)
        : all
      return filtered.slice(0, CAP).map(summarizeOrder)
    }
    case "get_order": {
      const o = await caller.serviceOrders.adminGetById({
        id: String(a.order_id),
      })
      if (!o) return { error: "Order not found." }
      return summarizeOrder(o as AnyOrder)
    }
    case "update_order_status": {
      const u = await caller.serviceOrders.updateStatus({
        id: String(a.order_id),
        status: a.status as ServiceOrderStatus,
      })
      return { id: u.id, status: u.status }
    }
    case "edit_order": {
      const u = await caller.serviceOrders.adminUpdate({
        id: String(a.order_id),
        ...(a.status !== undefined
          ? { status: a.status as ServiceOrderStatus }
          : {}),
        ...(a.amount !== undefined ? { amount: Number(a.amount) } : {}),
        ...(a.contact_company !== undefined
          ? { contactCompany: emptyToNull(a.contact_company) }
          : {}),
        ...(a.contact_email !== undefined
          ? { contactEmail: emptyToNull(a.contact_email) }
          : {}),
        ...(a.contact_phone !== undefined
          ? { contactPhone: emptyToNull(a.contact_phone) }
          : {}),
        ...(a.contact_address !== undefined
          ? { contactAddress: emptyToNull(a.contact_address) }
          : {}),
        ...(a.rdp_host !== undefined
          ? { rdpHost: emptyToNull(a.rdp_host) }
          : {}),
        ...(a.rdp_username !== undefined
          ? { rdpUsername: emptyToNull(a.rdp_username) }
          : {}),
        ...(a.rdp_password !== undefined
          ? { rdpPassword: emptyToNull(a.rdp_password) }
          : {}),
        ...(a.rdp_port !== undefined
          ? { rdpPort: emptyToNull(a.rdp_port) }
          : {}),
      })
      return { id: u.id, status: u.status }
    }
    case "delete_order": {
      await caller.serviceOrders.remove({
        id: String(a.order_id),
        ...(a.delete_invoice !== undefined
          ? { deleteInvoice: Boolean(a.delete_invoice) }
          : {}),
      })
      return { deleted: String(a.order_id) }
    }
    case "quote_order": {
      const r = await caller.serviceOrders.quoteCustomOrder({
        orderId: String(a.order_id),
        amount: Number(a.amount),
        ...(a.description !== undefined
          ? { description: String(a.description) }
          : {}),
      })
      return { id: r.id, status: r.status }
    }

    // ----- Invoices -----
    case "list_invoices": {
      const inv = (await caller.invoices.listAll({
        ...(a.status ? { status: a.status as PaymentStatus } : {}),
      })) as unknown as LooseInvoice[]
      return inv.slice(0, CAP).map((i) => ({
        id: i.id,
        number: i.number ?? null,
        amount: i.amount ?? null,
        status: i.status ?? null,
        company: i.organization?.name ?? null,
      }))
    }
    case "approve_invoice": {
      const r = await caller.invoices.approve({ id: String(a.invoice_id) })
      return { id: r.id, status: r.status }
    }
    case "reject_invoice": {
      const r = await caller.invoices.reject({
        id: String(a.invoice_id),
        reason: String(a.reason),
      })
      return { id: r.id, status: r.status }
    }
    case "send_invoice_reminder": {
      await caller.invoices.sendReminder({ id: String(a.invoice_id) })
      return { sent: true, invoice: String(a.invoice_id) }
    }
    case "create_invoice": {
      const r = await caller.invoices.create({
        organizationId: String(a.company_id),
        amount: Number(a.amount),
        ...(a.description !== undefined
          ? { description: String(a.description) }
          : {}),
      })
      return { id: r.id, number: r.number, amount: r.amount }
    }
    case "delete_invoice": {
      await caller.invoices.delete({ id: String(a.invoice_id) })
      return { deleted: String(a.invoice_id) }
    }

    // ----- Clients -----
    case "list_clients": {
      const clients =
        (await caller.admin.clientsWithCompanies()) as unknown as LooseClient[]
      return clients.slice(0, CAP).map((c) => ({
        id: c.id,
        name: c.name ?? null,
        email: c.email ?? null,
      }))
    }
    case "get_client": {
      const c = (await caller.admin.clientProfile({
        userId: String(a.client_id),
      })) as unknown as {
        id?: string
        name?: string | null
        email?: string
        phone?: string | null
        banned?: boolean | null
      }
      return {
        id: c.id ?? String(a.client_id),
        name: c.name ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
        suspended: c.banned ?? null,
      }
    }
    case "update_client": {
      const r = await caller.admin.updateClient({
        userId: String(a.client_id),
        ...(a.name !== undefined ? { name: String(a.name) } : {}),
        ...(a.email !== undefined ? { email: String(a.email) } : {}),
        ...(a.phone !== undefined ? { phone: emptyToNull(a.phone) } : {}),
        ...(a.address !== undefined ? { address: emptyToNull(a.address) } : {}),
      })
      return r
    }
    case "suspend_client": {
      const r = await caller.admin.setClientSuspended({
        userId: String(a.client_id),
        suspended: Boolean(a.suspended),
        ...(a.reason !== undefined ? { reason: String(a.reason) } : {}),
      })
      return r
    }
    case "delete_client": {
      const r = await caller.admin.deleteClient({ userId: String(a.client_id) })
      return r
    }

    // ----- Companies -----
    case "list_companies": {
      const orgs =
        (await caller.companies.listAll()) as unknown as LooseOrg[]
      return orgs.slice(0, CAP).map((o) => ({
        id: o.id,
        name: o.name ?? null,
        type: o.type ?? null,
        status: o.status ?? null,
        country: o.country ?? null,
      }))
    }
    case "get_company": {
      const c = (await caller.companies.getById({
        id: String(a.company_id),
      })) as unknown as LooseOrg & { companyId?: string | null }
      if (!c) return { error: "Company not found." }
      return {
        id: c.id,
        name: c.name ?? null,
        status: c.status ?? null,
        type: c.type ?? null,
        country: c.country ?? null,
        companyId: c.companyId ?? null,
      }
    }
    case "update_company_status": {
      const r = await caller.companies.updateStatus({
        id: String(a.company_id),
        status: a.status as CompanyStatus,
      })
      return { id: r.id, status: r.status }
    }
    case "review_document": {
      const r = await caller.companies.reviewDocument({
        documentId: String(a.document_id),
        status: a.status as "approved" | "rejected",
        ...(a.reason !== undefined ? { reason: String(a.reason) } : {}),
      })
      return r
    }
    case "request_document": {
      const r = await caller.companies.requestDocument({
        organizationId: String(a.company_id),
        name: String(a.name),
      })
      return { id: r.id, name: r.name, status: r.status }
    }

    // ----- Tickets -----
    case "list_tickets": {
      const tickets = (await caller.tickets.listAll({
        ...(a.status ? { status: a.status as TicketStatus } : {}),
      })) as unknown as LooseTicket[]
      return tickets.slice(0, CAP).map((t) => ({
        id: t.id,
        subject: t.subject ?? null,
        status: t.status ?? null,
        client: t.user?.name ?? t.user?.email ?? null,
      }))
    }
    case "set_ticket_status": {
      const r = await caller.tickets.updateStatus({
        id: String(a.ticket_id),
        status: a.status as TicketStatus,
      })
      return { id: r.id, status: r.status }
    }

    // ----- Packages -----
    case "list_packages": {
      const pkgs = (await caller.packages.list()) as unknown as LoosePackage[]
      return pkgs.slice(0, CAP).map((p) => ({
        id: p.id,
        title: p.title ?? null,
        price: p.price ?? null,
        country: p.country ?? null,
      }))
    }
    case "create_package": {
      const r = await caller.packages.create({
        title: String(a.title),
        description: String(a.description),
        country: a.country as "us" | "uk",
        features: a.features ?? [],
        price: Number(a.price),
      })
      return { id: r.id, title: r.title, price: r.price }
    }
    case "update_package": {
      const r = await caller.packages.update({
        id: String(a.package_id),
        ...(a.title !== undefined ? { title: String(a.title) } : {}),
        ...(a.description !== undefined
          ? { description: String(a.description) }
          : {}),
        ...(a.country !== undefined
          ? { country: a.country as "us" | "uk" }
          : {}),
        ...(a.features !== undefined ? { features: a.features } : {}),
        ...(a.price !== undefined ? { price: Number(a.price) } : {}),
      })
      return { id: r.id, title: r.title, price: r.price }
    }
    case "delete_package": {
      await caller.packages.delete({ id: String(a.package_id) })
      return { deleted: String(a.package_id) }
    }

    // ----- Coupons -----
    case "list_coupons": {
      const coupons = (await caller.coupons.list()) as unknown as LooseCoupon[]
      return coupons.slice(0, CAP).map((c) => ({
        id: c.id,
        code: c.code ?? null,
        discountType: c.discountType ?? null,
        discountValue: c.discountValue ?? null,
        enabled: c.enabled ?? null,
      }))
    }
    case "create_coupon": {
      const r = await caller.coupons.create({
        code: String(a.code),
        discountType: a.discount_type as CouponDiscountType,
        discountValue: Number(a.discount_value),
        ...(a.description !== undefined
          ? { description: String(a.description) }
          : {}),
        ...(a.enabled !== undefined ? { enabled: Boolean(a.enabled) } : {}),
        ...(a.min_subtotal !== undefined
          ? { minSubtotal: Number(a.min_subtotal) }
          : {}),
        ...(a.max_discount !== undefined
          ? { maxDiscount: Number(a.max_discount) }
          : {}),
      })
      return { id: r.id, code: r.code, enabled: r.enabled }
    }
    case "set_coupon_enabled": {
      const r = await caller.coupons.setEnabled({
        id: String(a.coupon_id),
        enabled: Boolean(a.enabled),
      })
      return { id: r.id, enabled: r.enabled }
    }
    case "delete_coupon": {
      await caller.coupons.delete({ id: String(a.coupon_id) })
      return { deleted: String(a.coupon_id) }
    }

    // ----- Finance -----
    case "approve_payout": {
      const r = await caller.payouts.approve({
        id: String(a.payout_id),
        ...(a.note !== undefined ? { adminNote: String(a.note) } : {}),
      })
      return { id: r.id, status: r.status }
    }
    case "reject_payout": {
      const r = await caller.payouts.reject({
        id: String(a.payout_id),
        ...(a.note !== undefined ? { adminNote: String(a.note) } : {}),
      })
      return { id: r.id, status: r.status }
    }
    case "adjust_wallet": {
      const r = await caller.wallet.adjustBalance({
        userId: String(a.client_id),
        direction: a.direction as "add" | "remove",
        amount: Number(a.amount),
        ...(a.note !== undefined ? { note: String(a.note) } : {}),
      })
      return r
    }
    case "approve_wallet_payment": {
      const r = await caller.wallet.approve({
        id: String(a.wallet_tx_id),
        ...(a.note !== undefined ? { adminNote: String(a.note) } : {}),
      })
      return r
    }
    case "reject_wallet_payment": {
      const r = await caller.wallet.reject({
        id: String(a.wallet_tx_id),
        ...(a.note !== undefined ? { adminNote: String(a.note) } : {}),
      })
      return r
    }

    // ----- Dashboard -----
    case "dashboard_summary": {
      return caller.admin.actionCounts()
    }

    // ----- Extraction -----
    case "save_extracted_document": {
      const doc = await prisma.extractedDocument.create({
        data: {
          kind: String(a.kind),
          data: (a.fields ?? {}) as Prisma.InputJsonValue,
          serviceOrderId: a.order_id ? String(a.order_id) : null,
          organizationId: a.company_id ? String(a.company_id) : null,
          clientId: a.client_id ? String(a.client_id) : null,
          status: "confirmed",
          createdById: user.id,
          createdByEmail: user.email,
        },
      })
      return {
        id: doc.id,
        kind: doc.kind,
        fields: doc.data,
        status: doc.status,
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

function summarizePending(name: string, args: Record<string, unknown>): string {
  const a = args as Record<string, string | number | boolean>
  switch (name) {
    case "add_service":
      return `Create a new service "${a.name}" at $${a.price}${
        a.type === "wordpress" ? " (WordPress)" : ""
      }.`
    case "modify_service":
      return `Update service ${a.service_id}: ${JSON.stringify(
        (args as { changes?: unknown }).changes ?? {},
      )}.`
    case "delete_service":
      return `Delete service ${a.service_id}. This cannot be undone.`
    case "update_order_status":
      return `Set order ${a.order_id} status to "${a.status}".`
    case "edit_order":
      return `Edit order ${a.order_id}.`
    case "delete_order":
      return `Delete order ${a.order_id}${
        a.delete_invoice ? " and its invoice" : ""
      }. This cannot be undone.`
    case "quote_order":
      return `Quote order ${a.order_id} at $${a.amount}.`
    case "approve_invoice":
      return `Approve invoice ${a.invoice_id} (mark it paid).`
    case "reject_invoice":
      return `Reject invoice ${a.invoice_id}: ${a.reason}.`
    case "send_invoice_reminder":
      return `Email a payment reminder for invoice ${a.invoice_id}.`
    case "create_invoice":
      return `Create a $${a.amount} invoice for company ${a.company_id}.`
    case "delete_invoice":
      return `Delete invoice ${a.invoice_id}. This cannot be undone.`
    case "update_client":
      return `Update client ${a.client_id}.`
    case "suspend_client":
      return a.suspended
        ? `Suspend client ${a.client_id}.`
        : `Un-suspend client ${a.client_id}.`
    case "delete_client":
      return `Permanently delete client ${a.client_id}. This cannot be undone.`
    case "update_company_status":
      return `Set company ${a.company_id} status to "${a.status}".`
    case "review_document":
      return `Mark document ${a.document_id} as ${a.status}.`
    case "request_document":
      return `Request "${a.name}" from company ${a.company_id}.`
    case "set_ticket_status":
      return `Set ticket ${a.ticket_id} status to "${a.status}".`
    case "create_package":
      return `Create package "${a.title}" (${a.country}) at $${a.price}.`
    case "update_package":
      return `Update package ${a.package_id}.`
    case "delete_package":
      return `Delete package ${a.package_id}. This cannot be undone.`
    case "create_coupon":
      return `Create coupon "${a.code}" (${a.discount_type} ${a.discount_value}).`
    case "set_coupon_enabled":
      return a.enabled
        ? `Enable coupon ${a.coupon_id}.`
        : `Disable coupon ${a.coupon_id}.`
    case "delete_coupon":
      return `Delete coupon ${a.coupon_id}. This cannot be undone.`
    case "approve_payout":
      return `Approve payout ${a.payout_id}.`
    case "reject_payout":
      return `Reject payout ${a.payout_id}.`
    case "adjust_wallet":
      return `${a.direction === "remove" ? "Remove" : "Add"} $${a.amount} ${
        a.direction === "remove" ? "from" : "to"
      } client ${a.client_id}'s wallet.`
    case "approve_wallet_payment":
      return `Approve wallet transaction ${a.wallet_tx_id}.`
    case "reject_wallet_payment":
      return `Reject wallet transaction ${a.wallet_tx_id}.`
    case "save_extracted_document":
      return `Save extracted ${a.kind} data${
        a.summary ? `: ${a.summary}` : ""
      }. Review the fields below before confirming.`
    default:
      return `Run ${name} with ${JSON.stringify(args)}.`
  }
}

function summarizeDone(name: string, args: Record<string, unknown>): string {
  const a = args as Record<string, string | number | boolean>
  switch (name) {
    case "add_service":
      return `Created service "${a.name}" at $${a.price}.`
    case "modify_service":
      return `Updated service ${a.service_id}.`
    case "delete_service":
      return `Deleted service ${a.service_id}.`
    case "update_order_status":
      return `Order ${a.order_id} is now "${a.status}".`
    case "edit_order":
      return `Updated order ${a.order_id}.`
    case "delete_order":
      return `Deleted order ${a.order_id}.`
    case "quote_order":
      return `Quoted order ${a.order_id} at $${a.amount}.`
    case "approve_invoice":
      return `Approved invoice ${a.invoice_id}.`
    case "reject_invoice":
      return `Rejected invoice ${a.invoice_id}.`
    case "send_invoice_reminder":
      return `Reminder sent for invoice ${a.invoice_id}.`
    case "create_invoice":
      return `Created a $${a.amount} invoice.`
    case "delete_invoice":
      return `Deleted invoice ${a.invoice_id}.`
    case "update_client":
      return `Updated client ${a.client_id}.`
    case "suspend_client":
      return a.suspended
        ? `Suspended client ${a.client_id}.`
        : `Un-suspended client ${a.client_id}.`
    case "delete_client":
      return `Deleted client ${a.client_id}.`
    case "update_company_status":
      return `Company ${a.company_id} is now "${a.status}".`
    case "review_document":
      return `Document ${a.document_id} marked ${a.status}.`
    case "request_document":
      return `Requested "${a.name}".`
    case "set_ticket_status":
      return `Ticket ${a.ticket_id} is now "${a.status}".`
    case "create_package":
      return `Created package "${a.title}".`
    case "update_package":
      return `Updated package ${a.package_id}.`
    case "delete_package":
      return `Deleted package ${a.package_id}.`
    case "create_coupon":
      return `Created coupon "${a.code}".`
    case "set_coupon_enabled":
      return a.enabled
        ? `Enabled coupon ${a.coupon_id}.`
        : `Disabled coupon ${a.coupon_id}.`
    case "delete_coupon":
      return `Deleted coupon ${a.coupon_id}.`
    case "approve_payout":
      return `Approved payout ${a.payout_id}.`
    case "reject_payout":
      return `Rejected payout ${a.payout_id}.`
    case "adjust_wallet":
      return `Adjusted client ${a.client_id}'s wallet by $${a.amount}.`
    case "approve_wallet_payment":
      return `Approved wallet transaction ${a.wallet_tx_id}.`
    case "reject_wallet_payment":
      return `Rejected wallet transaction ${a.wallet_tx_id}.`
    case "save_extracted_document":
      return `Saved extracted ${a.kind} document.`
    default:
      return `Done.`
  }
}

// ---------------------------------------------------------------------------
// Anthropic Messages API. Never logs or leaks the key. Auth via x-api-key +
// anthropic-version headers (NOT Bearer). Supports image/PDF content blocks.
// ---------------------------------------------------------------------------
type TextBlock = { type: "text"; text: string }
type ImageBlock = {
  type: "image"
  source: { type: "base64"; media_type: string; data: string }
}
type DocBlock = {
  type: "document"
  source: { type: "base64"; media_type: "application/pdf"; data: string }
}
type ToolUseBlock = {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}
type ToolResultBlock = {
  type: "tool_result"
  tool_use_id: string
  content: string
  is_error?: boolean
}
type ContentBlock =
  | TextBlock
  | ImageBlock
  | DocBlock
  | ToolUseBlock
  | ToolResultBlock
type AnthMessage = { role: "user" | "assistant"; content: string | ContentBlock[] }

export type Attachment = { kind: "image" | "pdf"; mediaType: string; data: string }

function attachmentBlock(att: Attachment): ImageBlock | DocBlock {
  if (att.kind === "pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: att.data },
    }
  }
  return {
    type: "image",
    source: { type: "base64", media_type: att.mediaType, data: att.data },
  }
}

type AnthResponse = { content: ContentBlock[]; stop_reason?: string }

async function callAnthropic(
  key: string,
  system: string,
  messages: AnthMessage[],
  model: string,
): Promise<AnthResponse> {
  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        // Cache the stable prefix (tools + system). Tools render before system,
        // so one breakpoint on the system block caches both — a big saving since
        // the 40+ tool schemas are resent on every turn of the tool-use loop.
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        messages,
        tools: TOOLS,
      }),
      signal: AbortSignal.timeout(60000),
    })
  } catch {
    throw new Error("Couldn't reach Anthropic (timeout or network error).")
  }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Anthropic rejected the API key. Update it in Settings.")
    }
    if (res.status === 429) {
      throw new Error("Anthropic is rate-limiting requests. Try again shortly.")
    }
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.error?.message ? ` — ${body.error.message}` : ""
    } catch {
      // ignore body parse errors
    }
    throw new Error(`Anthropic request failed (HTTP ${res.status})${detail}.`)
  }
  const data = await res.json().catch(() => null)
  if (!data || !Array.isArray(data.content)) {
    throw new Error("Anthropic returned an unexpected response.")
  }
  return data as AnthResponse
}

const SYSTEM_PROMPT = `You are the WEBMOSH admin assistant. You help an authenticated admin manage the platform — services, orders, invoices, clients, companies/formations, support tickets, packages, coupons, payouts and wallets — by calling the provided tools, and by reading documents they attach.
Rules:
- Use tools to read or change real data — never invent data.
- Read and list tools run immediately. Any tool that creates, edits, deletes, approves/rejects, sends an email, or moves money will ask the admin to confirm before it runs — so you don't need to ask for confirmation yourself, just call the tool.
- If you need an id the admin didn't give, call a matching list tool first to find it.
- When the admin attaches an image or PDF (an invoice, ID document, or a payment/transaction screenshot), read it carefully and call save_extracted_document with the fields you can read. Never guess or fabricate financial amounts or ID numbers — leave anything unclear as null. The admin will review and confirm before it is saved.
- Be concise. Summarize lists as short, readable bullet points.`

export type AgentToolCall = { name: string; args: unknown; result: unknown }
export type PendingConfirmation = {
  name: string
  args: Record<string, unknown>
  summary: string
}
export type ExtractedData = {
  kind: string
  fields: Record<string, unknown>
  summary?: string
}
export type AgentReply = {
  reply: string
  toolCalls: AgentToolCall[]
  pendingConfirmation: PendingConfirmation | null
  extractedData: ExtractedData | null
}

export async function runAgentChat({
  messages,
  attachments,
  user,
}: {
  messages: { role: "user" | "assistant"; content: string }[]
  attachments?: Attachment[]
  user: AgentUser
}): Promise<AgentReply> {
  const key = await getAnthropicKey()
  if (!key) {
    throw new Error(
      "No Anthropic API key is configured. Add one under Settings → AI Agent.",
    )
  }

  const hasAttachments = (attachments?.length ?? 0) > 0
  // Haiku (the admin-selected default) for chat; escalate to Sonnet only when a
  // document is attached (image/PDF extraction). If the admin explicitly chose
  // Sonnet in Settings, that choice stands for all requests.
  const model = hasAttachments ? STRONG_MODEL : await getModel()

  // Only send the last 10 turns to keep input tokens (and cost) bounded. The
  // Anthropic API requires the first message to be a user turn.
  let history = messages.slice(-10)
  if (history[0]?.role === "assistant") history = history.slice(1)

  // Build the Anthropic message array. Attachments go on the last user turn.
  const convo: AnthMessage[] = history.map((m, i) => {
    const isLast = i === history.length - 1
    if (isLast && m.role === "user" && hasAttachments) {
      const blocks: ContentBlock[] = attachments!.map(attachmentBlock)
      blocks.push({
        type: "text",
        text: m.content || "Please read the attached document(s) and extract the data.",
      })
      return { role: "user", content: blocks }
    }
    return { role: m.role, content: m.content }
  })

  const executed: AgentToolCall[] = []

  // Tool-use loop: read-only tools run automatically; a confirm-required tool
  // stops the loop and surfaces a pending confirmation for the admin.
  for (let iter = 0; iter < 6; iter++) {
    const resp = await callAnthropic(key, SYSTEM_PROMPT, convo, model)
    const toolUses = resp.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    )
    const text = resp.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    if (toolUses.length === 0) {
      return {
        reply: text || "Done.",
        toolCalls: executed,
        pendingConfirmation: null,
        extractedData: null,
      }
    }

    // If the model wants a confirmation-required action, stop and ask.
    const confirmTu = toolUses.find((tu) => CONFIRM_TOOLS.has(tu.name))
    if (confirmTu) {
      const args = validateArgs(confirmTu.name, confirmTu.input)
      const extractedData =
        confirmTu.name === "save_extracted_document"
          ? {
              kind: String(args.kind),
              fields: (args.fields ?? {}) as Record<string, unknown>,
              summary: args.summary ? String(args.summary) : undefined,
            }
          : null
      return {
        reply:
          text || "I'm ready to run this — please confirm to proceed.",
        toolCalls: executed,
        pendingConfirmation: {
          name: confirmTu.name,
          args,
          summary: summarizePending(confirmTu.name, args),
        },
        extractedData,
      }
    }

    // Read-only tools: execute all, feed results back for the next turn.
    convo.push({ role: "assistant", content: resp.content })
    const results: ToolResultBlock[] = []
    for (const tu of toolUses) {
      let result: unknown
      let isErr = false
      try {
        const args = validateArgs(tu.name, tu.input)
        result = await execTool(tu.name, args, user)
        executed.push({ name: tu.name, args, result })
        await logAudit({
          actorId: user.id,
          actorEmail: user.email,
          action: `ai.tool.${tu.name}`,
          meta: { args } as never,
          after: result as never,
        })
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "Tool failed." }
        isErr = true
        executed.push({ name: tu.name, args: tu.input, result })
      }
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result).slice(0, 6000),
        is_error: isErr,
      })
    }
    convo.push({ role: "user", content: results })
  }

  return {
    reply: "I couldn't finish that within a reasonable number of steps.",
    toolCalls: executed,
    pendingConfirmation: null,
    extractedData: null,
  }
}

/** Best-effort before-state capture for the audit trail on mutations. */
async function captureBefore(
  name: string,
  a: Record<string, string>,
  caller: Awaited<ReturnType<typeof getCaller>>,
): Promise<unknown> {
  try {
    if (name === "delete_service" || name === "modify_service") {
      return await caller.services.getById({ id: a.service_id })
    }
    if (
      name === "update_order_status" ||
      name === "edit_order" ||
      name === "delete_order"
    ) {
      return await caller.serviceOrders.adminGetById({ id: a.order_id })
    }
    if (name === "update_package" || name === "delete_package") {
      return await caller.packages.getById({ id: a.package_id })
    }
    if (
      name === "update_client" ||
      name === "suspend_client" ||
      name === "delete_client"
    ) {
      return await caller.admin.clientProfile({ userId: a.client_id })
    }
  } catch {
    // best-effort only
  }
  return null
}

function auditTarget(
  name: string,
  a: Record<string, string>,
  result: unknown,
): { targetType: string; targetId: string | null } {
  const idKeys = [
    "service_id",
    "order_id",
    "invoice_id",
    "company_id",
    "document_id",
    "client_id",
    "ticket_id",
    "payout_id",
    "wallet_tx_id",
    "package_id",
    "coupon_id",
  ]
  let targetId: string | null = null
  for (const k of idKeys) {
    if (a[k]) {
      targetId = String(a[k])
      break
    }
  }
  let targetType = "unknown"
  if (name === "save_extracted_document") {
    targetType = "extracted_document"
    targetId = (result as { id?: string })?.id ?? null
  } else if (name.includes("order")) targetType = "service_order"
  else if (name.includes("service")) targetType = "service"
  else if (name.includes("invoice")) targetType = "invoice"
  else if (name.includes("client")) targetType = "client"
  else if (name.includes("company") || name.includes("document"))
    targetType = "company"
  else if (name.includes("ticket")) targetType = "ticket"
  else if (name.includes("payout")) targetType = "payout"
  else if (name.includes("wallet")) targetType = "wallet"
  else if (name.includes("package")) targetType = "package"
  else if (name.includes("coupon")) targetType = "coupon"
  return { targetType, targetId }
}

export async function runAgentConfirm({
  name,
  args,
  user,
}: {
  name: string
  args: unknown
  user: AgentUser
}): Promise<{ reply: string; toolCall: AgentToolCall }> {
  if (!CONFIRM_TOOLS.has(name)) {
    throw new Error("This action doesn't require confirmation.")
  }
  const validated = validateArgs(name, args)
  const a = validated as Record<string, string>

  const caller = await getCaller(user)
  const before = await captureBefore(name, a, caller)
  const result = await execTool(name, validated, user)
  const { targetType, targetId } = auditTarget(name, a, result)

  await logAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: `ai.tool.${name}`,
    targetType,
    targetId,
    before: (before ?? undefined) as never,
    after: result as never,
    meta: { args: validated } as never,
  })

  return {
    reply: `✅ ${summarizeDone(name, validated)}`,
    toolCall: { name, args: validated, result },
  }
}
