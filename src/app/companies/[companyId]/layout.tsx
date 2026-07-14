"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

export default function CompanyScopedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const params = useParams()
  const companyId = typeof params?.companyId === "string" ? params.companyId : undefined
  const { data: companies, isLoading } = trpc.companies.myCompanies.useQuery()

  const notAMember =
    !isLoading && companies !== undefined && companyId
      ? !companies.some((c) => c.id === companyId)
      : false

  useEffect(() => {
    if (notAMember) {
      router.replace("/companies")
    }
  }, [notAMember, router])

  if (isLoading || notAMember) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return <>{children}</>
}
