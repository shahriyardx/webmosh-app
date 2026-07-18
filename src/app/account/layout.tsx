"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { UserSidebar } from "@/components/user-sidebar"
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

function getBreadcrumb(pathname: string) {
  if (pathname === "/account") return "My Account"
  if (pathname === "/account/documents") return "Documents"
  if (pathname === "/account/services") return "Services"
  if (pathname === "/account/orders") return "Orders"
  if (pathname.startsWith("/account/orders/")) return "Order"
  if (pathname === "/account/invoices") return "Payments"
  if (pathname.startsWith("/account/invoices/")) return "Payment"
  if (pathname === "/account/wallet") return "Wallet"
  if (pathname === "/account/mail") return "Mail"
  if (pathname === "/account/tickets") return "Support"
  if (pathname.startsWith("/account/tickets/")) return "Ticket"
  return "My Account"
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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

  return (
    <SidebarProvider>
      <UserSidebar
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
                  <BreadcrumbPage>{getBreadcrumb(pathname)}</BreadcrumbPage>
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
