"use client"

import { useEffect } from "react"
import { useRouter, usePathname, useParams } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

function sectionLabel(pathname: string, companyId: string) {
  const rest = pathname.replace(`/companies/${companyId}`, "")
  if (rest === "" || rest === "/overview") return null
  if (rest.startsWith("/documents")) return "Documents"
  if (rest.startsWith("/services")) return "Services"
  if (rest.startsWith("/orders")) return "Orders"
  if (rest.startsWith("/invoices")) return "Payments"
  if (rest.startsWith("/mail")) return "Mail"
  if (rest.startsWith("/tickets")) return "Support"
  return null
}

export default function CompaniesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const companyId = typeof params?.companyId === "string" ? params.companyId : undefined
  const { data: session, isPending: authPending } = authClient.useSession()
  const isAdmin = session?.user?.role === "admin"
  const { data: companies, isLoading: companiesLoading } =
    trpc.companies.myCompanies.useQuery(undefined, {
      enabled: !!session,
    })

  useEffect(() => {
    if (!authPending && !session) {
      router.push("/")
      return
    }
    if (!authPending && session?.user?.role === "freelancer") {
      router.replace("/freelancer")
      return
    }
    if (
      !authPending &&
      session &&
      !isAdmin &&
      !companiesLoading &&
      companies &&
      companies.length === 0
    ) {
      router.replace("/onboard")
    }
  }, [session, authPending, isAdmin, companies, companiesLoading, router])

  if (authPending || (session && !isAdmin && companiesLoading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!session) return null
  if (session.user?.role === "freelancer") return null
  if (!isAdmin && companies && companies.length === 0) return null

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
  }

  const currentCompany = companyId
    ? companies?.find((c) => c.id === companyId)
    : undefined
  const section = companyId ? sectionLabel(pathname, companyId) : null

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: session.user?.name || "",
          email: session.user?.email || "",
        }}
        onSignOut={handleSignOut}
        companyId={companyId}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {!companyId ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage>Companies</BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/companies">Companies</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    {section ? (
                      <>
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href={`/companies/${companyId}/overview`}>
                              <span className="uppercase">
                                {currentCompany?.name ?? "Company"}
                              </span>
                            </Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>{section}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    ) : (
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          <span className="uppercase">
                            {currentCompany?.name ?? "Company"}
                          </span>
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    )}
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
