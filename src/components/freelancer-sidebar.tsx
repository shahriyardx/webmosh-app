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
  LayoutDashboardIcon,
  ClipboardListIcon,
  UserIcon,
  WalletIcon,
  MessagesSquareIcon,
} from "lucide-react"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"

const links = [
  { title: "Dashboard", href: "/freelancer", icon: LayoutDashboardIcon },
  { title: "My Tasks", href: "/freelancer/tasks", icon: ClipboardListIcon },
  {
    title: "Discussions",
    href: "/freelancer/discussions",
    icon: MessagesSquareIcon,
  },
  { title: "Payouts", href: "/freelancer/payouts", icon: WalletIcon },
  { title: "Profile", href: "/freelancer/profile", icon: UserIcon },
]

export function FreelancerSidebar({
  user,
  onSignOut,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; avatar?: string }
  onSignOut?: () => void
}) {
  const pathname = usePathname()
  const { data: unreadDiscussions } = trpc.discussions.unreadCount.useQuery(
    undefined,
    { refetchInterval: 30_000, refetchOnWindowFocus: true },
  )

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
                  Freelancer
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  tooltip={link.title}
                  isActive={
                    link.href === "/freelancer"
                      ? pathname === link.href
                      : pathname.startsWith(link.href)
                  }
                >
                  <Link href={link.href}>
                    <link.icon />
                    <span>{link.title}</span>
                    {link.title === "Discussions" &&
                      unreadDiscussions !== undefined &&
                      unreadDiscussions > 0 && (
                        <Badge className="ml-auto size-5 rounded-full p-0 text-[10px]">
                          {unreadDiscussions}
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
