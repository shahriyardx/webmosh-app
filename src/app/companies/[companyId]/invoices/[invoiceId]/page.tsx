"use client"

import { use } from "react"
import { useParams } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import Link from "next/link"
import { formatInvoiceNumber } from "@/lib/invoice-number"
import { InvoiceCoupon } from "@/components/invoice-coupon"
import { InvoiceSummaryCard } from "@/components/invoice-summary-card"
import { InvoicePayPanel } from "@/components/invoice-pay-panel"

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = use(params)
  const routeParams = useParams()
  const companyId = typeof routeParams?.companyId === "string" ? routeParams.companyId : ""
  const utils = trpc.useUtils()

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id: invoiceId })
  const { data: settings } = trpc.settings.getAll.useQuery()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
      </div>
    )
  }

  const canPay = invoice.status !== "paid"
  const rate = settings?.usd_to_bdt_rate ? parseFloat(settings.usd_to_bdt_rate) : null

  const onChanged = () => {
    utils.invoices.getById.invalidate({ id: invoiceId })
    utils.invoices.list.invalidate({ organizationId: companyId })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href={`/companies/${companyId}/invoices`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            Invoice {formatInvoiceNumber(invoice.number)}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">{invoice.id}</p>
        </div>
        <Button variant="outline" asChild>
          <a href={`/companies/${companyId}/invoices/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer">
            <DownloadIcon className="size-4" />
            Download
          </a>
        </Button>
      </div>

      {canPay ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <div className="lg:sticky lg:top-6">
            <InvoiceSummaryCard invoice={invoice} bdtRate={rate} />
          </div>
          <div className="space-y-6">
            <InvoiceCoupon
              invoiceId={invoiceId}
              couponCode={invoice.couponCode}
              discountAmount={invoice.discountAmount}
              originalAmount={invoice.originalAmount}
              onChanged={onChanged}
            />
            <InvoicePayPanel
              invoiceId={invoiceId}
              bdtRate={rate}
              onChanged={onChanged}
            />
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl">
          <InvoiceSummaryCard invoice={invoice} bdtRate={rate} />
        </div>
      )}
    </div>
  )
}
