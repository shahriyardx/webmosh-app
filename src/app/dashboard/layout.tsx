"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
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
} from "@/components/ui/breadcrumb"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { data: session, isPending: authPending } = authClient.useSession()
  const isAdmin = session?.user?.role === "admin"
  const { data: companies, isLoading: companiesLoading } =
    trpc.companies.myCompanies.useQuery(undefined, {
      enabled: !!session && !isAdmin,
    })

  useEffect(() => {
    if (!authPending && !session) {
      router.push("/")
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
  // Freshly-onboarding users have no org yet — hide chrome while we redirect.
  if (!isAdmin && companies && companies.length === 0) return null

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: session.user?.name || "",
          email: session.user?.email || "",
        }}
        onSignOut={handleSignOut}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
