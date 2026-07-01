import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
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
const footer = { fontSize: "12px", color: "#9ca3af", margin: "16px 0 0" }
const hr = { borderColor: "#e5e7eb", margin: "24px 0" }

export function NotificationEmail({
  heading,
  preview,
  greeting,
  intro,
  details,
  paragraphs,
  cta,
}: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview ?? heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>Webmosh</Text>
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

          <Hr style={hr} />
          <Text style={footer}>
            Webmosh — Company formation for the UK & US. This is an automated
            message; please do not reply directly.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default NotificationEmail
