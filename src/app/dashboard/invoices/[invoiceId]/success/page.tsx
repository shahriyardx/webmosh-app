"use client"

import { use, useEffect } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Loader2Icon, CheckCircleIcon, XCircleIcon, ArrowLeftIcon } from "lucide-react"

export default function InvoiceSuccessPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const { invoiceId } = use(params)
  const utils = trpc.useUtils()

  const sessionId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("session_id")
      : null

  const verify = trpc.invoices.verifyStripeSession.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate()
      utils.invoices.getById.invalidate({ id: invoiceId })
    },
  })

  useEffect(() => {
    if (sessionId) {
      verify.mutate({ sessionId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const isPending = verify.isPending
  const isSuccess = verify.isSuccess
  const isError = verify.isError

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="max-w-sm text-center">
        {isPending && (
          <div className="space-y-4">
            <Loader2Icon className="mx-auto size-10 animate-spin text-amber-500" />
            <h1 className="text-xl font-semibold">Verifying Payment</h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your payment…
            </p>
          </div>
        )}

        {isSuccess && (
          <div className="space-y-4">
            <CheckCircleIcon className="mx-auto size-10 text-green-500" />
            <h1 className="text-xl font-semibold">Payment Successful</h1>
            <p className="text-sm text-muted-foreground">
              Your invoice has been paid. Thank you!
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button asChild>
                <Link href={`/dashboard/invoices/${invoiceId}`}>View Invoice</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/invoices">All Invoices</Link>
              </Button>
            </div>
          </div>
        )}

        {isError && (
          <div className="space-y-4">
            <XCircleIcon className="mx-auto size-10 text-red-500" />
            <h1 className="text-xl font-semibold">Verification Failed</h1>
            <p className="text-sm text-muted-foreground">
              {verify.error?.message ?? "Could not verify payment. Please contact support."}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/invoices/${invoiceId}`}>
                  <ArrowLeftIcon className="mr-1.5 size-4" />
                  Back to Invoice
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
