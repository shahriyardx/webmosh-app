import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export interface NotificationEmailProps {
  heading: string
  preview?: string
  greeting?: string
  intro: string
  details?: { label: string; value: string }[]
  paragraphs?: string[]
  cta?: { label: string; url: string }
  logoUrl?: string
  items?: { title: string; amount: number }[]
  total?: number
  qrDataUrl?: string
  qrCaption?: string
}

const main = { backgroundColor: "#f6f6f6", fontFamily: "Arial, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "560px",
  borderRadius: "12px",
}
const brand = { color: "#0EA5E9", fontSize: "20px", fontWeight: "bold" as const, margin: "0 0 24px" }
const logo = { height: "36px", width: "auto", margin: "0 0 24px" }
const h1 = { fontSize: "18px", fontWeight: "bold" as const, color: "#111827", margin: "0 0 12px" }
const text = { fontSize: "14px", lineHeight: "22px", color: "#374151", margin: "0 0 12px" }
const detailRow = { fontSize: "14px", lineHeight: "20px", color: "#374151", margin: "0 0 6px" }
const label = { color: "#6b7280" }
const button = {
  backgroundColor: "#0EA5E9",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  padding: "10px 20px",
  borderRadius: "8px",
  display: "inline-block",
  margin: "12px 0",
}
const footer = { fontSize: "12px", color: "#9ca3af", margin: "16px 0 0", lineHeight: "18px" }
const footerBrand = {
  fontSize: "13px",
  color: "#374151",
  fontWeight: "bold" as const,
  margin: "0 0 4px",
  letterSpacing: "0.5px",
}
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }
const tableWrap = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  overflow: "hidden" as const,
  margin: "16px 0",
}
const tableHead = { backgroundColor: "#f9fafb", padding: "8px 12px" }
const tableHeadText = {
  fontSize: "11px",
  fontWeight: "bold" as const,
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: 0,
}
const tableRow = {
  padding: "10px 12px",
  borderTop: "1px solid #e5e7eb",
}
const tableRowFirst = {
  padding: "10px 12px",
}
const itemTitle = {
  fontSize: "14px",
  color: "#111827",
  fontWeight: "500" as const,
  margin: 0,
}
const itemAmount = {
  fontSize: "14px",
  color: "#111827",
  margin: 0,
  textAlign: "right" as const,
}
const totalRow = {
  padding: "10px 12px",
  borderTop: "1px solid #e5e7eb",
  backgroundColor: "#f9fafb",
}
const totalLabel = {
  fontSize: "13px",
  color: "#374151",
  fontWeight: "bold" as const,
  margin: 0,
}
const totalValue = {
  fontSize: "15px",
  color: "#0EA5E9",
  fontWeight: "bold" as const,
  margin: 0,
  textAlign: "right" as const,
}
const qrBox = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
  textAlign: "center" as const,
}
const qrImg = {
  width: "180px",
  height: "180px",
  margin: "0 auto",
}
const qrCaptionText = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "8px 0 0",
}

export function NotificationEmail({
  heading,
  preview,
  greeting,
  intro,
  details,
  paragraphs,
  cta,
  logoUrl,
  items,
  total,
  qrDataUrl,
  qrCaption,
}: NotificationEmailProps) {
  const computedTotal =
    total ?? (items?.reduce((s, i) => s + i.amount, 0) ?? 0)
  return (
    <Html>
      <Head />
      <Preview>{preview ?? heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          {logoUrl ? (
            <Img src={logoUrl} alt="Webmosh" style={logo} />
          ) : (
            <Text style={brand}>Webmosh</Text>
          )}
          <Heading style={h1}>{heading}</Heading>
          {greeting && <Text style={text}>{greeting}</Text>}
          <Text style={text}>{intro}</Text>

          {details && details.length > 0 && (
            <Section style={{ margin: "12px 0" }}>
              {details.map((d) => (
                <Text key={d.label} style={detailRow}>
                  <span style={label}>{d.label}: </span>
                  {d.value}
                </Text>
              ))}
            </Section>
          )}

          {items && items.length > 0 && (
            <Section style={tableWrap}>
              <table
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{ borderCollapse: "collapse" }}
              >
                <tbody>
                  <tr>
                    <td style={tableHead}>
                      <Text style={tableHeadText}>Description</Text>
                    </td>
                    <td style={{ ...tableHead, textAlign: "right" }}>
                      <Text style={tableHeadText}>Amount</Text>
                    </td>
                  </tr>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td style={i === 0 ? tableRowFirst : tableRow}>
                        <Text style={itemTitle}>{it.title}</Text>
                      </td>
                      <td
                        style={{
                          ...(i === 0 ? tableRowFirst : tableRow),
                          textAlign: "right",
                        }}
                      >
                        <Text style={itemAmount}>${it.amount.toFixed(2)}</Text>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={totalRow}>
                      <Text style={totalLabel}>Total Due</Text>
                    </td>
                    <td style={{ ...totalRow, textAlign: "right" }}>
                      <Text style={totalValue}>
                        ${computedTotal.toFixed(2)}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

          {paragraphs?.map((p, i) => (
            <Text key={i} style={text}>
              {p}
            </Text>
          ))}

          {cta && (
            <Link href={cta.url} style={button}>
              {cta.label}
            </Link>
          )}

          {qrDataUrl && (
            <Section style={qrBox}>
              <Img src={qrDataUrl} alt="Payment QR" style={qrImg} />
              <Text style={qrCaptionText}>
                {qrCaption ??
                  "Scan with any Bangla QR enabled app (bKash, Nagad, Rocket or your bank app) to pay."}
              </Text>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footerBrand}>
            WEBMOSH — Marketing, Optimization, Solutions, Hosting
          </Text>
          <Text style={footer}>
            This is an automated message; please do not reply directly.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default NotificationEmail
