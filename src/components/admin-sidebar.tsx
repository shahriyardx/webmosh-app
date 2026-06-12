"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { NavUser } from "@/components/nav-user"
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
  ShieldIcon,
  Building2Icon,
  FileTextIcon,
  PackageIcon,
  ConciergeBellIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  Settings,
} from "lucide-react"

const links = [
  { title: "Dashboard", href: "/admin", icon: ShieldIcon },
  {
    title: "Formations",
    href: "/admin/formations",
    icon: Building2Icon,
  },
  {
    title: "Documents",
    href: "/admin/documents",
    icon: FileTextIcon,
  },
  {
    title: "Packages",
    href: "/admin/packages",
    icon: PackageIcon,
  },
  {
    title: "Services",
    href: "/admin/services",
    icon: ConciergeBellIcon,
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingCartIcon,
  },
  {
    title: "Invoices",
    href: "/admin/invoices",
    icon: ReceiptIcon,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar({
  user,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string }
  onSignOut?: () => void
}) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GalleryVerticalEndIcon />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Webmosh</span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
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
