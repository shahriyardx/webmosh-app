const BASE = "https://api.company-information.service.gov.uk"

function authHeader() {
  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) return null
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`
}

export interface CompaniesHouseProfile {
  companyNumber: string
  name: string | null
  status: string | null
  statusDetail: string | null
  type: string | null
  incorporationDate: string | null
  jurisdiction: string | null
  registeredOffice: string | null
  sicCodes: string[]
  accountsNextDue: string | null
  accountsOverdue: boolean
  confirmationNextDue: string | null
  confirmationOverdue: boolean
  officers: {
    name: string
    role: string | null
    appointedOn: string | null
    resignedOn: string | null
    address: string | null
    dateOfBirth: string | null
    nationality: string | null
    countryOfResidence: string | null
  }[]
  officerCount: number
  resignedCount: number
  filings: {
    transactionId: string | null
    date: string | null
    type: string | null
    category: string | null
    description: string | null
    hasDocument: boolean
  }[]
}

function formatAddress(a: Record<string, string> | undefined): string | null {
  if (!a) return null
  return [a.premises, a.address_line_1, a.address_line_2, a.locality, a.region, a.postal_code, a.country]
    .filter(Boolean)
    .join(", ")
}

export async function getCompaniesHouseProfile(
  number: string,
): Promise<CompaniesHouseProfile | null> {
  const auth = authHeader()
  if (!auth) return null

  const res = await fetch(`${BASE}/company/${encodeURIComponent(number)}`, {
    headers: { Authorization: auth },
    // Cache 1h at the fetch layer
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await res.json()

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  let officers: CompaniesHouseProfile["officers"] = []
  let officerCount = 0
  let resignedCount = 0
  try {
    const oRes = await fetch(
      `${BASE}/company/${encodeURIComponent(number)}/officers?items_per_page=35`,
      { headers: { Authorization: auth }, next: { revalidate: 3600 } },
    )
    if (oRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const od: any = await oRes.json()
      officerCount = od.active_count ?? 0
      resignedCount = od.resigned_count ?? 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      officers = (od.items ?? []).map((o: any) => {
        const dob = o.date_of_birth
        const dobStr =
          dob?.year && dob?.month ? `${MONTHS[dob.month - 1]} ${dob.year}` : null
        return {
          name: o.name,
          role: o.officer_role ?? null,
          appointedOn: o.appointed_on ?? null,
          resignedOn: o.resigned_on ?? null,
          address: formatAddress(o.address),
          dateOfBirth: dobStr,
          nationality: o.nationality ?? null,
          countryOfResidence: o.country_of_residence ?? null,
        }
      })
    }
  } catch {
    // officers optional
  }

  let filings: CompaniesHouseProfile["filings"] = []
  try {
    const fRes = await fetch(
      `${BASE}/company/${encodeURIComponent(number)}/filing-history?items_per_page=25`,
      { headers: { Authorization: auth }, next: { revalidate: 3600 } },
    )
    if (fRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fd: any = await fRes.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filings = (fd.items ?? []).map((f: any) => ({
        transactionId: f.transaction_id ?? null,
        date: f.date ?? null,
        type: f.type ?? null,
        category: f.category ?? null,
        description: f.description ?? null,
        hasDocument: !!f.links?.document_metadata,
      }))
    }
  } catch {
    // filings optional
  }

  return {
    companyNumber: d.company_number ?? number,
    name: d.company_name ?? null,
    status: d.company_status ?? null,
    statusDetail: d.company_status_detail ?? null,
    type: d.type ?? null,
    incorporationDate: d.date_of_creation ?? null,
    jurisdiction: d.jurisdiction ?? null,
    registeredOffice: formatAddress(d.registered_office_address),
    sicCodes: d.sic_codes ?? [],
    accountsNextDue: d.accounts?.next_due ?? null,
    accountsOverdue: !!d.accounts?.overdue,
    confirmationNextDue: d.confirmation_statement?.next_due ?? null,
    confirmationOverdue: !!d.confirmation_statement?.overdue,
    officers,
    officerCount,
    resignedCount,
    filings,
  }
}

/** Lightweight fetch of filing due-dates + basics from Companies House. */
export async function getCompaniesHouseDates(
  number: string,
): Promise<{
  accountsNextDue: string | null
  confirmationNextDue: string | null
  incorporationDate: string | null
  status: string | null
} | null> {
  const auth = authHeader()
  if (!auth) return null
  const res = await fetch(`${BASE}/company/${encodeURIComponent(number)}`, {
    headers: { Authorization: auth },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await res.json()
  return {
    accountsNextDue: d.accounts?.next_due ?? null,
    confirmationNextDue: d.confirmation_statement?.next_due ?? null,
    incorporationDate: d.date_of_creation ?? null,
    status: d.company_status ?? null,
  }
}
