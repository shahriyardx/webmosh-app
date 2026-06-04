"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
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
  const pathname = usePathname()
  const { data: session, isPending: authPending } = authClient.useSession()
  const [settingActive, setSettingActive] = useState(false)

  const { data: orgList, isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => authClient.organization.list(),
    enabled: !!session,
  })

  const organizations = orgList?.data ?? []
  const activeOrgId = session?.session?.activeOrganizationId

  // Auth check
  useEffect(() => {
    if (!authPending && !session) {
      router.push("/")
    }
  }, [session, authPending, router])

  // No orgs → onboard
  useEffect(() => {
    if (session && !orgsLoading && orgList && !organizations.length) {
      router.push("/onboard")
    }
  }, [session, orgsLoading, orgList, organizations.length, router])

  // Has orgs but no active → set first as active
  useEffect(() => {
    if (
      session &&
      !orgsLoading &&
      organizations.length > 0 &&
      !activeOrgId &&
      !settingActive
    ) {
      setSettingActive(true)
      authClient.organization
        .setActive({ organizationId: organizations[0].id })
        .then(() => {
          router.refresh()
        })
    }
  }, [session, orgsLoading, organizations, activeOrgId, settingActive, router])

  // Loading state
  if (authPending || (session && orgsLoading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!session) return null
  if (!organizations.length) return null

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
                  <BreadcrumbPage>
                    {pathname === "/dashboard" ? "Dashboard" : ""}
                  </BreadcrumbPage>
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
