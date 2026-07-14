"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { NavUser } from "@/components/nav-user"
import { ThemeToggle } from "@/components/theme-toggle"
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
  Building2Icon,
  LayoutDashboardIcon,
  FileTextIcon,
  ConciergeBellIcon,
  ShoppingCartIcon,
  ReceiptIcon,
  MailIcon,
  LifeBuoyIcon,
  UserXIcon,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const links = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Documents", href: "/account/documents", icon: FileTextIcon },
  { title: "Services", href: "/account/services", icon: ConciergeBellIcon },
  { title: "Orders", href: "/account/orders", icon: ShoppingCartIcon },
  { title: "Payments", href: "/account/invoices", icon: ReceiptIcon },
  { title: "Mail", href: "/account/mail", icon: MailIcon },
  { title: "Support", href: "/account/tickets", icon: LifeBuoyIcon },
]

export function UserSidebar({
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

  const { data: pendingDocCount } =
    trpc.companies.pendingDocCountForUser.useQuery()
  const { data: unreadMailCount } = trpc.mails.unreadCountForUser.useQuery()
  const { data: pendingTicketCount } = trpc.tickets.pendingCount.useQuery()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 px-2 py-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/logo.png"
                alt="Webmosh"
                width={36}
                height={36}
                className="size-9 shrink-0 object-contain"
                priority
              />
              <span className="truncate text-xl font-bold uppercase tracking-tight">
                Webmosh
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarMenu>
            {links.slice(0, 1).map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.title}
                  isActive={pathname === "/dashboard"}
                >
                  <Link href={link.href}>
                    <link.icon />
                    <span>{link.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Companies" isActive={false}>
                <Link href="/companies">
                  <Building2Icon />
                  <span>Companies</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {links.slice(1).map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.title}
                  isActive={
                    link.href === "/account"
                      ? pathname === "/account"
                      : pathname.startsWith(link.href)
                  }
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
        <ThemeToggle />
        <NavUser user={user} onLogout={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
