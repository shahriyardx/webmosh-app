"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { FreelancerSidebar } from "@/components/freelancer-sidebar"
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
  if (pathname === "/freelancer") return "Dashboard"
  if (pathname === "/freelancer/tasks") return "My Tasks"
  if (pathname.startsWith("/freelancer/tasks/")) return "Task"
  if (pathname === "/freelancer/discussions") return "Discussions"
  if (pathname === "/freelancer/payouts") return "Payouts"
  if (pathname === "/freelancer/profile") return "Profile"
  return "Freelancer"
}

export default function FreelancerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending: authPending } = authClient.useSession()

  useEffect(() => {
    if (authPending) return
    if (!session) {
      router.push("/")
      return
    }
    const role = session.user?.role
    if (role === "admin") {
      router.replace("/admin")
      return
    }
    if (role !== "freelancer") {
      router.replace("/dashboard")
    }
  }, [session, authPending, router])

  if (authPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!session || session.user?.role !== "freelancer") return null

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <SidebarProvider>
      <FreelancerSidebar
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
