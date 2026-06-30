"use client"

import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Building2Icon,
  UsersIcon,
  DollarSignIcon,
  FileTextIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  ArrowRightIcon,
} from "lucide-react"

const statusBadge: Record<string, { label: string; variant: "outline" | "secondary" | "default" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = trpc.companies.getStats.useQuery()

  if (isLoading || !stats) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  const statCards = [
    {
      title: "Formations",
      icon: Building2Icon,
      value: stats.totalFormations,
      sub: `${stats.pendingFormations} pending · ${stats.processingFormations} processing`,
      href: "/admin/formations",
    },
    {
      title: "Revenue",
      icon: DollarSignIcon,
      value: `$${stats.revenue.toLocaleString()}`,
      sub: "From paid invoices",
      href: "/admin/invoices",
    },
    {
      title: "Users",
      icon: UsersIcon,
      value: stats.totalUsers,
      sub: "Registered users",
      href: "/admin/formations",
    },
    {
      title: "Completed",
      icon: Building2Icon,
      value: stats.completedFormations,
      sub: "Finished formations",
      href: "/admin/formations",
    },
  ]

  const attention = [
    {
      title: "Documents to review",
      icon: FileTextIcon,
      value: stats.docsToReview,
      href: "/admin/formations",
    },
    {
      title: "Invoices to review",
      icon: ReceiptIcon,
      value: stats.processingInvoices,
      href: "/admin/invoices",
    },
    {
      title: "Unpaid invoices",
      icon: ReceiptIcon,
      value: stats.unpaidInvoices,
      href: "/admin/invoices",
    },
    {
      title: "Pending orders",
      icon: ShoppingCartIcon,
      value: stats.pendingOrders,
      href: "/admin/orders",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of formations, revenue, and items needing attention.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <card.icon className="size-4 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-foreground">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Needs attention */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Needs attention
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {attention.map((item) => (
            <Link key={item.title} href={item.href}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center justify-between py-5">
                  <div className="flex items-center gap-3">
                    <item.icon className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {item.title}
                    </span>
                  </div>
                  <Badge
                    variant={item.value > 0 ? "default" : "outline"}
                    className="text-sm"
                  >
                    {item.value}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent formations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Building2Icon className="size-4 text-amber-500" />
              Recent Formations
            </div>
            <Link
              href="/admin/formations"
              className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              View all
              <ArrowRightIcon className="size-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentFormations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No formations yet.</p>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentFormations.map((org) => {
                    const sb = statusBadge[org.status] ?? statusBadge.pending
                    return (
                      <TableRow
                        key={org.id}
                        className="cursor-pointer"
                        onClick={() => {
                          window.location.href = `/admin/formations/${org.id}`
                        }}
                      >
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell className="uppercase">{org.country ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={sb.variant}>{sb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
