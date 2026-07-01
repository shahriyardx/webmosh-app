"use client"

import { use } from "react"
import { TicketThread } from "@/components/ticket-thread"

export default function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <TicketThread ticketId={id} admin backHref="/admin/tickets" />
}
