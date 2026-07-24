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

type CountKey =
  | "formations"
  | "wordpress"
  | "orders"
  | "tickets"
  | "freelancers"
  | "discussions"
  | "payouts"
  | "invoices"
  | "wallet"
  | "exchange"

const links: {
  title: string
  href: string
  icon: typeof ShieldIcon
  badge?: CountKey
}[] = [
  { title: "Dashboard", href: "/admin", icon: ShieldIcon },
  { title: "Formations", href: "/admin/formations", icon: Building2Icon, badge: "formations" },
  { title: "Packages", href: "/admin/packages", icon: PackageIcon },
  { title: "Services", href: "/admin/services", icon: ConciergeBellIcon },
  { title: "Wordpress", href: "/admin/wordpress-demo", icon: PaletteIcon },
  { title: "Orders", href: "/admin/orders", icon: ShoppingCartIcon, badge: "orders" },
  { title: "Tickets", href: "/admin/tickets", icon: LifeBuoyIcon, badge: "tickets" },
  { title: "Clients", href: "/admin/users", icon: UsersIcon },
  { title: "Freelancers", href: "/admin/freelancers", icon: UserCogIcon, badge: "freelancers" },
  { title: "Discussions", href: "/admin/discussions", icon: MessagesSquareIcon, badge: "discussions" },
  { title: "Payouts", href: "/admin/payouts", icon: WalletIcon, badge: "payouts" },
  { title: "Invoices", href: "/admin/invoices", icon: ReceiptIcon, badge: "invoices" },
  { title: "Wallet", href: "/admin/wallet", icon: CreditCardIcon, badge: "wallet" },
  { title: "Coupons", href: "/admin/coupons", icon: TicketPercentIcon },
  { title: "Exchange", href: "/admin/exchange", icon: ArrowLeftRightIcon, badge: "exchange" },
  { title: "Emails", href: "/admin/emails", icon: MailIcon },
  { title: "Settings", href: "/admin/settings", icon: Settings },
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
  const { data: counts } = trpc.admin.actionCounts.useQuery(undefined, {
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
                    {link.badge &&
                      (counts?.[link.badge] ?? 0) > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {counts?.[link.badge]}
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
