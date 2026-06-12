"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  GalleryVerticalEndIcon,
  LayoutDashboardIcon,
  FileTextIcon,
  ConciergeBellIcon,
  ShoppingCartIcon,
  ReceiptIcon,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"

const links = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Documents", href: "/dashboard/documents", icon: FileTextIcon },
  { title: "Services", href: "/dashboard/services", icon: ConciergeBellIcon },
  { title: "Orders", href: "/dashboard/orders", icon: ShoppingCartIcon },
  { title: "Invoices", href: "/dashboard/invoices", icon: ReceiptIcon },
]

export function AppSidebar({
  user,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string }
  onSignOut?: () => void
}) {
  const pathname = usePathname()

  const { data: orgList } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => authClient.organization.list(),
  })
  const hasOrgs = (orgList?.data?.length ?? 0) > 0

  const { data: pendingDocCount } =
    trpc.companies.getPendingDocCount.useQuery()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {hasOrgs ? (
          <TeamSwitcher />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GalleryVerticalEndIcon />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Webmosh</span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.title}
                  isActive={pathname === link.href}
                >
                  <Link href={link.href}>
                    <link.icon />
                    <span>{link.title}</span>
                    {link.title === "Documents" &&
                      pendingDocCount !== undefined &&
                      pendingDocCount > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {pendingDocCount}
                        </Badge>
                      )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
