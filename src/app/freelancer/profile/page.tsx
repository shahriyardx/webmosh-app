"use client"

import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"

export default function FreelancerProfilePage() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  if (!user) return null

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your freelancer account.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <Avatar className="size-16">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-sky-500">
              Freelancer
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="text-sm font-semibold">Change your password</p>
          <p className="text-xs text-muted-foreground">
            Password changes are managed by your admin at the moment. Reach out
            to them if you need it reset.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
