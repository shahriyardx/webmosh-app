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
  UserXIcon,
  LifeBuoyIcon,
  WalletIcon,
  PlusIcon,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function AppSidebar({
  user,
  onSignOut,
  companyId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string }
  onSignOut?: () => void
  companyId?: string
}) {
  const pathname = usePathname()

  const { data: session } = authClient.useSession()
  const isImpersonating = !!session?.session?.impersonatedBy

  const handleStopImpersonating = async () => {
    await authClient.admin.stopImpersonating()
    window.location.href = "/admin"
  }

  const base = companyId ? `/companies/${companyId}` : "/account"
  const scopedLinks = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
    { title: "Documents", href: `${base}/documents`, icon: FileTextIcon },
    { title: "Services", href: `${base}/services`, icon: ConciergeBellIcon },
    { title: "Orders", href: `${base}/orders`, icon: ShoppingCartIcon },
    { title: "Payments", href: `${base}/invoices`, icon: ReceiptIcon },
    { title: "Wallet", href: "/account/wallet", icon: WalletIcon },
    { title: "Mail", href: `${base}/mail`, icon: MailIcon },
    { title: "Support", href: `${base}/tickets`, icon: LifeBuoyIcon },
  ]

  const companiesActive =
    pathname === "/companies" ||
    (!!companyId && pathname === `/companies/${companyId}/overview`)

  const { data: scopedPendingDocCount } =
    trpc.companies.getPendingDocCount.useQuery(
      { organizationId: companyId ?? "" },
      { enabled: !!companyId },
    )
  const { data: userPendingDocCount } =
    trpc.companies.pendingDocCountForUser.useQuery(undefined, {
      enabled: !companyId,
    })
  const pendingDocCount = companyId ? scopedPendingDocCount : userPendingDocCount

  const { data: scopedUnreadMailCount } = trpc.mails.unreadCount.useQuery(
    { organizationId: companyId ?? "" },
    { enabled: !!companyId },
  )
  const { data: userUnreadMailCount } = trpc.mails.unreadCountForUser.useQuery(
    undefined,
    { enabled: !companyId },
  )
  const unreadMailCount = companyId ? scopedUnreadMailCount : userUnreadMailCount

  const { data: pendingTicketCount } = trpc.tickets.pendingCount.useQuery(
    companyId ? { organizationId: companyId } : undefined,
  )
  const { data: walletBalance } = trpc.wallet.myBalance.useQuery()

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
            {scopedLinks.slice(0, 1).map((link) => (
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
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Companies"
                isActive={companiesActive}
              >
                <Link href="/companies">
                  <Building2Icon />
                  <span>Companies</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {scopedLinks.slice(1).map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.title}
                  isActive={pathname.startsWith(link.href)}
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
                    {link.title === "Wallet" && (
                      <span className="ml-auto text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                        ${(walletBalance?.available ?? 0).toFixed(2)}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Link
          href="/account/wallet"
          className="group/wallet block group-data-[collapsible=icon]:hidden"
        >
          <div className="relative mx-1 overflow-hidden rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-transparent p-3 transition-colors group-hover/wallet:border-sky-500/40 group-hover/wallet:bg-sky-500/10">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <WalletIcon className="size-3.5 text-sky-500" />
                Wallet balance
              </span>
              <span className="flex size-5 items-center justify-center rounded-md bg-sky-500/15 text-sky-500 transition-colors group-hover/wallet:bg-sky-500 group-hover/wallet:text-white">
                <PlusIcon className="size-3" />
              </span>
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
              ${(walletBalance?.available ?? 0).toFixed(2)}
            </p>
            {(walletBalance?.pendingTopup ?? 0) > 0 ? (
              <p className="mt-0.5 text-[11px] text-amber-500">
                ${walletBalance!.pendingTopup.toFixed(2)} pending verification
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Tap to add money or withdraw
              </p>
            )}
          </div>
        </Link>
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
