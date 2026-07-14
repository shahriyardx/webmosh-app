"use client"

import { use } from "react"
import { useParams } from "next/navigation"
import { TicketThread } from "@/components/ticket-thread"

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const routeParams = useParams()
  const companyId = typeof routeParams?.companyId === "string" ? routeParams.companyId : ""
  return <TicketThread ticketId={id} backHref={`/companies/${companyId}/tickets`} />
}
