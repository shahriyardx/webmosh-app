import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TrpcProvider } from "@/lib/trpc/provider"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const siteUrl =
  process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "https://webmosh.com"

const description =
  "Webmosh helps you form and manage your UK and US companies online — fast incorporation, document handling, compliance deadlines, and ongoing filings in one dashboard."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Webmosh — Company Formation for the UK & US",
    template: "%s · Webmosh",
  },
  description,
  applicationName: "Webmosh",
  keywords: [
    "company formation",
    "UK company registration",
    "US company registration",
    "incorporate a company",
    "Companies House",
    "LLC formation",
    "business registration",
    "Webmosh",
  ],
  authors: [{ name: "Webmosh" }],
  creator: "Webmosh",
  publisher: "Webmosh",
  openGraph: {
    type: "website",
    siteName: "Webmosh",
    title: "Webmosh — Company Formation for the UK & US",
    description,
    url: siteUrl,
    images: [{ url: "/logo.png", width: 500, height: 500, alt: "Webmosh" }],
  },
  twitter: {
    card: "summary",
    title: "Webmosh — Company Formation for the UK & US",
    description,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <TrpcProvider>{children}</TrpcProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
