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
  ShieldIcon,
  Building2Icon,
  PackageIcon,
  ConciergeBellIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  UsersIcon,
  LifeBuoyIcon,
  PaletteIcon,
  UserCogIcon,
  WalletIcon,
  MailIcon,
  CreditCardIcon,
  MessagesSquareIcon,
  TicketPercentIcon,
  ArrowLeftRightIcon,
  Settings,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"

const links = [
  { title: "Dashboard", href: "/admin", icon: ShieldIcon },
  {
    title: "Formations",
    href: "/admin/formations",
    icon: Building2Icon,
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
    title: "Wordpress",
    href: "/admin/wordpress-demo",
    icon: PaletteIcon,
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingCartIcon,
  },
  {
    title: "Tickets",
    href: "/admin/tickets",
    icon: LifeBuoyIcon,
  },
  {
    title: "Clients",
    href: "/admin/users",
    icon: UsersIcon,
  },
  {
    title: "Freelancers",
    href: "/admin/freelancers",
    icon: UserCogIcon,
  },
  {
    title: "Discussions",
    href: "/admin/discussions",
    icon: MessagesSquareIcon,
  },
  {
    title: "Payouts",
    href: "/admin/payouts",
    icon: WalletIcon,
  },
  {
    title: "Invoices",
    href: "/admin/invoices",
    icon: ReceiptIcon,
  },
  {
    title: "Wallet",
    href: "/admin/wallet",
    icon: CreditCardIcon,
  },
  {
    title: "Coupons",
    href: "/admin/coupons",
    icon: TicketPercentIcon,
  },
  {
    title: "Exchange",
    href: "/admin/exchange",
    icon: ArrowLeftRightIcon,
  },
  {
    title: "Emails",
    href: "/admin/emails",
    icon: MailIcon,
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
  const { data: openTickets } = trpc.tickets.adminOpenCount.useQuery()
  const { data: unreadDiscussions } = trpc.discussions.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000, refetchOnWindowFocus: true },
  )
  const { data: pendingApprovals } = trpc.tasks.pendingApprovalCount.useQuery(
    undefined,
    { refetchInterval: 30_000, refetchOnWindowFocus: true },
  )
  const { data: pendingWallet } = trpc.wallet.pendingCount.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2.5 px-2 py-2">
              <Image
                src="/logo.png"
                alt="Webmosh"
                width={36}
                height={36}
                className="size-9 shrink-0 object-contain"
                priority
              />
              <div className="grid flex-1 leading-tight">
                <span className="truncate text-xl font-bold uppercase tracking-tight">
                  Webmosh
                </span>
                <span className="truncate text-xs font-medium uppercase tracking-widest text-muted-foreground">
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
                    {link.title === "Tickets" &&
                      openTickets !== undefined &&
                      openTickets > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {openTickets}
                        </Badge>
                      )}
                    {link.title === "Discussions" &&
                      unreadDiscussions !== undefined &&
                      unreadDiscussions > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {unreadDiscussions}
                        </Badge>
                      )}
                    {link.title === "Freelancers" &&
                      pendingApprovals !== undefined &&
                      pendingApprovals > 0 && (
                        <Badge className="ml-auto size-5 rounded-full bg-amber-500 p-0 text-[10px] text-white hover:bg-amber-500">
                          {pendingApprovals}
                        </Badge>
                      )}
                    {link.title === "Wallet" &&
                      pendingWallet !== undefined &&
                      pendingWallet > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {pendingWallet}
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
        <ThemeToggle />
        <NavUser user={user} onLogout={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
