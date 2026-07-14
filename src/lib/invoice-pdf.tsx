import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface InvoicePdfData {
  invoiceNumber: string;
  date: string;
  status: "paid" | "unpaid" | "processing" | "rejected";
  amount: number;
  logoUrl?: string;
  billTo: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  items: {
    title: string;
    amount: number;
    features?: string[];
  }[];
  from?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  qrDataUrl?: string;
}

const COMPANY_DEFAULT = {
  name: "WEBMOSH",
  phone: "+8801608534154",
  email: "info@webmosh.com",
  address: "House# 322, Nayanogor Road, Turag, Uttara, Dhaka 1230",
};

const BRAND = "#0EA5E9";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

const statusStyle: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  paid: { label: "PAID", color: "#15803d", bg: "#dcfce7" },
  unpaid: { label: "UNPAID", color: "#b45309", bg: "#fef3c7" },
  processing: { label: "PROCESSING", color: "#1d4ed8", bg: "#dbeafe" },
  rejected: { label: "REJECTED", color: "#b91c1c", bg: "#fee2e2" },
};

const s = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingHorizontal: 44,
    paddingBottom: 72,
    fontSize: 9.5,
    color: INK,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandWrap: { flexDirection: "row", alignItems: "center" },
  logo: { width: 46, height: 46, objectFit: "contain", marginRight: 10 },
  brandName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: INK,
    letterSpacing: 1,
  },
  brandTag: { fontSize: 8, color: MUTED, marginTop: 1 },
  headerRight: { width: 200, alignItems: "flex-end" },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textAlign: "right",
    letterSpacing: 2,
    lineHeight: 1,
  },
  invoiceMetaBlock: { marginTop: 10, alignItems: "flex-end" },
  invoiceMeta: {
    fontSize: 9,
    color: MUTED,
    textAlign: "right",
    lineHeight: 1.4,
  },
  invoiceMetaValue: { color: INK, fontFamily: "Helvetica-Bold" },

  accent: { height: 3, backgroundColor: BRAND, borderRadius: 2, marginTop: 14 },

  // Parties
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
  },
  partyCol: { width: "48%" },
  label: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  partyName: { fontFamily: "Helvetica-Bold", fontSize: 11, color: INK },
  partyLine: { color: "#475569", marginTop: 2 },

  // Status + due summary (right aligned band)
  summary: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryDue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 2,
  },
  statusPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },

  // Table
  tableHead: {
    flexDirection: "row",
    backgroundColor: INK,
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 26,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    fontSize: 8.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: LINE,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  itemRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 12 },
  colItem: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1.4, textAlign: "right" },
  colAmount: { flex: 1.4, textAlign: "right" },
  itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: INK },
  feature: { color: MUTED, marginTop: 3, fontSize: 8.5 },

  // Totals
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 18,
  },
  totalsBox: { width: 240 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: { color: MUTED },
  totalsValue: { color: INK, fontFamily: "Helvetica-Bold" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
  },
  grandLabel: { fontFamily: "Helvetica-Bold", color: INK },
  grandValue: { fontFamily: "Helvetica-Bold", color: BRAND, fontSize: 13 },

  // Pay QR
  payBox: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  qr: { width: 96, height: 96, marginRight: 16 },
  payTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK },
  payText: { fontSize: 9, color: MUTED, marginTop: 4, maxWidth: 300 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 32,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: MUTED },
});

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const paid = data.status === "paid";
  const totalDue = paid ? 0 : data.amount;
  const amountPaid = paid ? data.amount : 0;
  const st = statusStyle[data.status] ?? statusStyle.unpaid;
  const company = {
    name: data.from?.name || COMPANY_DEFAULT.name,
    address: data.from?.address || COMPANY_DEFAULT.address,
    phone: data.from?.phone || COMPANY_DEFAULT.phone,
    email: data.from?.email || COMPANY_DEFAULT.email,
  };

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author="Webmosh"
      subject="Invoice"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.brandWrap}>
            {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : null}
            <View>
              <Text style={s.brandName}>{company.name}</Text>
              <Text style={s.brandTag}>
                Marketing, Optimization, Solution, Hosting
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <View style={s.invoiceMetaBlock}>
              <Text style={s.invoiceMeta}>
                No. <Text style={s.invoiceMetaValue}>{data.invoiceNumber}</Text>
              </Text>
              <Text style={s.invoiceMeta}>
                Date <Text style={s.invoiceMetaValue}>{data.date}</Text>
              </Text>
            </View>
          </View>
        </View>
        <View style={s.accent} />

        {/* Parties */}
        <View style={s.parties}>
          <View style={s.partyCol}>
            <Text style={s.label}>From</Text>
            <Text style={s.partyName}>{company.name}</Text>
            <Text style={s.partyLine}>{company.address}</Text>
            <Text style={s.partyLine}>{company.phone}</Text>
            <Text style={s.partyLine}>{company.email}</Text>
          </View>
          <View style={s.partyCol}>
            <Text style={s.label}>Bill To</Text>
            <Text style={s.partyName}>{data.billTo.name}</Text>
            {data.billTo.address ? (
              <Text style={s.partyLine}>{data.billTo.address}</Text>
            ) : null}
            {data.billTo.phone ? (
              <Text style={s.partyLine}>{data.billTo.phone}</Text>
            ) : null}
            {data.billTo.email ? (
              <Text style={s.partyLine}>{data.billTo.email}</Text>
            ) : null}
          </View>
        </View>

        {/* Summary band */}
        <View style={s.summary}>
          <View>
            <Text style={s.summaryLabel}>Total Due</Text>
            <Text style={s.summaryDue}>{money(totalDue)}</Text>
          </View>
          <Text
            style={[s.statusPill, { color: st.color, backgroundColor: st.bg }]}
          >
            {st.label}
          </Text>
        </View>

        {/* Items */}
        <View style={s.tableHead}>
          <Text style={s.colItem}>Description</Text>
          <Text style={s.colQty}>Qty</Text>
          <Text style={s.colRate}>Rate</Text>
          <Text style={s.colAmount}>Amount</Text>
        </View>
        <View style={s.tableBody}>
          {data.items.map((it, i) => (
            <View key={i} style={s.itemRow}>
              <View style={s.colItem}>
                <Text style={s.itemTitle}>{it.title}</Text>
                {(it.features ?? []).map((f, j) => (
                  <Text key={j} style={s.feature}>
                    {j + 1}. {f}
                  </Text>
                ))}
              </View>
              <Text style={s.colQty}>1</Text>
              <Text style={s.colRate}>{money(it.amount)}</Text>
              <Text style={s.colAmount}>{money(it.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsWrap}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Subtotal</Text>
              <Text style={s.totalsValue}>{money(data.amount)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Amount Paid</Text>
              <Text style={s.totalsValue}>{money(amountPaid)}</Text>
            </View>
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Total Due</Text>
              <Text style={s.grandValue}>{money(totalDue)}</Text>
            </View>
          </View>
        </View>

        {/* Pay via QR */}
        {!paid && data.qrDataUrl ? (
          <View style={s.payBox}>
            <Image src={data.qrDataUrl} style={s.qr} />
            <View>
              <Text style={s.payTitle}>Scan to Pay — Bangla QR</Text>
              <Text style={s.payText}>
                Scan this QR with any Bangla QR enabled app (bKash, Nagad,
                Rocket or your bank app) to pay {money(totalDue)}.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Thank you for choosing Webmosh.</Text>
          <Text style={s.footerText}>
            {company.email} · {company.phone}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
