"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { AdminSidebar } from "@/components/admin-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

const breadcrumbTitles: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/packages": "Packages",
  "/admin/users": "Users",
  "/admin/formations": "Formations",
  "/admin/documents": "Documents",
  "/admin/tickets": "Tickets",
  "/admin/settings": "Settings",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/")
      return
    }
    if (!isPending && session?.user?.role !== "admin") {
      router.push("/dashboard")
    }
  }, [session, isPending, router])

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (session?.user?.role !== "admin") return null

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <SidebarProvider>
      <AdminSidebar
        user={{
          name: session.user?.name || "Admin",
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
                    {breadcrumbTitles[pathname] ?? "Admin"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  )
}
