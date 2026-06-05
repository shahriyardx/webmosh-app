"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Shield, Users, Building2, FileText } from "lucide-react"

export default function AdminDashboardPage() {
  const adminCards = [
    {
      title: "Users",
      description: "Manage all users",
      icon: Users,
      value: "—",
      href: "/admin/users",
    },
    {
      title: "Formations",
      description: "Pending company formations",
      icon: Building2,
      value: "0",
      href: "/admin/formations",
    },
    {
      title: "Documents",
      description: "Submitted documents",
      icon: FileText,
      value: "0",
      href: "/admin/documents",
    },
    {
      title: "Admin",
      description: "Admin controls",
      icon: Shield,
      value: "",
      href: "/admin/settings",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, formations, and system settings.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </div>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
                <card.icon className="size-4 text-amber-500" />
              </div>
            </CardHeader>
            {card.value && (
              <CardContent>
                <p className="text-3xl font-semibold text-foreground">
                  {card.value}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
