"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { AdminSidebar } from "@/components/admin-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Shield, Users, Building2, FileText } from "lucide-react"

export default function AdminDashboardPage() {
  const router = useRouter()
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

  const userName = session.user?.name || "Admin"
  const userEmail = session.user?.email || ""

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
  }

  const adminCards = [
    {
      title: "Users",
      description: "Manage all users",
      icon: Users,
      value: "—",
      href: "/admin/users",
    },
    {
      title: "Formations",
      description: "Pending company formations",
      icon: Building2,
      value: "0",
      href: "/admin/formations",
    },
    {
      title: "Documents",
      description: "Submitted documents",
      icon: FileText,
      value: "0",
      href: "/admin/documents",
    },
    {
      title: "Admin",
      description: "Admin controls",
      icon: Shield,
      value: "",
      href: "/admin/settings",
    },
  ]

  return (
    <SidebarProvider>
      <AdminSidebar
        user={{
          name: userName,
          email: userEmail,
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
                  <BreadcrumbPage>Admin Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <main className="flex flex-1 flex-col p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage users, formations, and system settings.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {adminCards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </div>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <card.icon className="size-4 text-amber-500" />
                  </div>
                </CardHeader>
                {card.value && (
                  <CardContent>
                    <p className="text-3xl font-semibold text-foreground">
                      {card.value}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
