"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
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
  MailIcon,
  UserXIcon,
  LifeBuoyIcon,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const links = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Documents", href: "/dashboard/documents", icon: FileTextIcon },
  { title: "Services", href: "/dashboard/services", icon: ConciergeBellIcon },
  { title: "Orders", href: "/dashboard/orders", icon: ShoppingCartIcon },
  { title: "Invoices", href: "/dashboard/invoices", icon: ReceiptIcon },
  { title: "Mail", href: "/dashboard/mail", icon: MailIcon },
  { title: "Support", href: "/dashboard/tickets", icon: LifeBuoyIcon },
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

  const { data: session } = authClient.useSession()
  const isImpersonating = !!session?.session?.impersonatedBy

  const handleStopImpersonating = async () => {
    await authClient.admin.stopImpersonating()
    window.location.href = "/admin"
  }

  const { data: myCompanies } = trpc.companies.myCompanies.useQuery()
  const hasOrgs = (myCompanies?.length ?? 0) > 0

  const { data: pendingDocCount } =
    trpc.companies.getPendingDocCount.useQuery()

  const { data: unreadMailCount } = trpc.mails.unreadCount.useQuery()

  const { data: pendingTicketCount } = trpc.tickets.pendingCount.useQuery()

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
                    {link.title === "Mail" &&
                      unreadMailCount !== undefined &&
                      unreadMailCount > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {unreadMailCount}
                        </Badge>
                      )}
                    {link.title === "Support" &&
                      pendingTicketCount !== undefined &&
                      pendingTicketCount > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {pendingTicketCount}
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
        {isImpersonating && (
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start"
            onClick={handleStopImpersonating}
          >
            <UserXIcon className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">
              Stop impersonating
            </span>
          </Button>
        )}
        <NavUser user={user} onLogout={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
