"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, Building2Icon } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const { data: orgList } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => authClient.organization.list(),
  })

  const [switching, setSwitching] = React.useState(false)

  const organizations: {
    id: string
    name: string
    slug: string
    logo: string | null
  }[] = orgList?.data ?? []
  const activeOrgId = session?.session?.activeOrganizationId
  const activeOrgData = organizations.find((o) => o.id === activeOrgId)

  const handleSwitch = async (orgId: string) => {
    if (switching || orgId === activeOrgId) return
    setSwitching(true)
    try {
      await authClient.organization.setActive({ organizationId: orgId })
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  if (!organizations.length) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Building2Icon className="size-5" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium uppercase">
                  {activeOrgData?.name ?? "No organization"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Companies
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="gap-2 p-2"
                disabled={switching}
              >
                <span className="flex-1 truncate uppercase">{org.name}</span>
                {org.id === activeOrgId && (
                  <span className="text-xs text-muted-foreground">Active</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => router.push("/onboard")}
            >
              <div className="font-medium text-muted-foreground">
                + New Company
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
