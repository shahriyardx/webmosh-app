import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"

export interface InvoicePdfData {
  invoiceNumber: string
  date: string
  status: "paid" | "unpaid" | "processing" | "rejected"
  amount: number
  logoUrl?: string
  billTo: {
    name: string
    phone?: string | null
    email?: string | null
    address?: string | null
  }
  item: {
    title: string
    features: string[]
  }
}

const COMPANY = {
  name: "WEBMOSH",
  phone: "+8801608534154",
  email: "info@webmosh.com",
  address: "House# 322, Nayanogor Road, Turag, Uttara, Dhaka 1230",
}

const BANK = [
  "The city Bank",
  "ACC number : 2303365324001",
  "Routing: 225851450",
  "Name: MD Samayun Kabir",
  "Branch: Rangpur",
  "Swift Code: CIBLBDDH",
]

const statusLabel: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  processing: "Processing",
  rejected: "Rejected",
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#1f2937", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 70, height: 70, objectFit: "contain" },
  invoiceTitle: { fontSize: 34, color: "#111827", textAlign: "right" },
  invoiceNo: { fontSize: 11, color: "#6b7280", textAlign: "right", marginTop: 2 },

  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24, alignItems: "center" },
  metaLabel: { color: "#6b7280", marginRight: 16 },

  totalDueBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    width: 260,
    alignSelf: "flex-end",
  },
  statusBox: {
    borderWidth: 1,
    borderColor: "#166534",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    width: 260,
    alignSelf: "flex-end",
  },
  statusText: { color: "#166534", fontFamily: "Helvetica-Bold" },

  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#6b7280" },
  block: { marginTop: 24 },
  line: { marginTop: 2 },

  tableHead: {
    flexDirection: "row",
    backgroundColor: "#374151",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 24,
  },
  colItem: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.5, textAlign: "right" },

  itemRow: { flexDirection: "row", paddingHorizontal: 8, paddingTop: 10 },
  feature: { color: "#6b7280", marginTop: 3, fontSize: 9 },

  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalsLabel: { color: "#6b7280", width: 90, textAlign: "right", marginRight: 16 },
  totalsValue: { width: 70, textAlign: "right" },

  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", color: "#6b7280", fontSize: 9 },
})

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const paid = data.status === "paid"
  const totalDue = paid ? 0 : data.amount
  const amountPaid = paid ? data.amount : 0

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : <View />}
          <View>
            <Text style={s.invoiceTitle}>Invoice</Text>
            <Text style={s.invoiceNo}># {data.invoiceNumber}</Text>
          </View>
        </View>

        {/* Date + total due + status */}
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Date:</Text>
          <Text style={s.bold}>{data.date}</Text>
        </View>
        <View style={s.totalDueBox}>
          <Text style={s.bold}>Total Due:</Text>
          <Text style={s.bold}>${totalDue.toFixed(2)}</Text>
        </View>
        <View style={s.statusBox}>
          <Text style={s.statusText}>{statusLabel[data.status] ?? data.status}</Text>
        </View>

        {/* From */}
        <View style={s.block}>
          <Text style={s.bold}>{COMPANY.name}</Text>
          <Text style={s.line}>{COMPANY.phone}</Text>
          <Text style={s.line}>{COMPANY.email}</Text>
          <Text style={s.line}>{COMPANY.address}</Text>
        </View>

        {/* Bill To */}
        <View style={s.block}>
          <Text style={s.muted}>Bill To:</Text>
          <Text style={[s.bold, s.line]}>{data.billTo.name}</Text>
          {data.billTo.phone ? <Text style={s.line}>{data.billTo.phone}</Text> : null}
          {data.billTo.email ? <Text style={s.line}>{data.billTo.email}</Text> : null}
          {data.billTo.address ? <Text style={s.line}>{data.billTo.address}</Text> : null}
        </View>

        {/* Items table */}
        <View style={s.tableHead}>
          <Text style={s.colItem}>Item</Text>
          <Text style={s.colQty}>Quantity</Text>
          <Text style={s.colRate}>Rate</Text>
          <Text style={s.colAmount}>Amount</Text>
        </View>
        <View style={s.itemRow}>
          <View style={s.colItem}>
            <Text style={s.bold}>{data.item.title}</Text>
            {data.item.features.map((f, i) => (
              <Text key={i} style={s.feature}>
                {i + 1}. {f}
              </Text>
            ))}
          </View>
          <Text style={s.colQty}>1</Text>
          <Text style={s.colRate}>${data.amount.toFixed(2)}</Text>
          <Text style={s.colAmount}>${data.amount.toFixed(2)}</Text>
        </View>

        {/* Totals */}
        <View style={[s.totalsRow, { marginTop: 28 }]}>
          <Text style={s.totalsLabel}>Total:</Text>
          <Text style={s.totalsValue}>${data.amount.toFixed(2)}</Text>
        </View>
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Amount Paid:</Text>
          <Text style={s.totalsValue}>${amountPaid.toFixed(2)}</Text>
        </View>

        {/* Bank details */}
        <View style={{ marginTop: 40 }}>
          <Text style={s.muted}>Bank Transfer Details :</Text>
          {BANK.map((b, i) => (
            <Text key={i} style={s.line}>
              {b}
            </Text>
          ))}
        </View>

        <Text style={s.footer}>Thanks For Choosing WEBMOSH.</Text>
      </Page>
    </Document>
  )
}

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />)
}
