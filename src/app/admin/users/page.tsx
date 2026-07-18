"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
} from "@/components/ui/multi-select"
import { UsersIcon, LogInIcon, ArrowRightIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AdminUsersPage() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  const handleImpersonate = async (userId: string) => {
    setImpersonatingId(userId)
    try {
      const res = await authClient.admin.impersonateUser({ userId })
      if (res.error) throw new Error(res.error.message)
      router.push("/dashboard")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to impersonate")
      setImpersonatingId(null)
    }
  }

  const {
    data: users,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data?.users ?? []
    },
  })

  const promoteFreelancer = trpc.freelancers.promote.useMutation()
  const demoteFreelancer = trpc.freelancers.demote.useMutation()

  const handleRoleChange = async (
    userId: string,
    role: "user" | "admin" | "freelancer",
    currentRole: string,
  ) => {
    setSavingId(userId)
    try {
      if (role === "freelancer") {
        await promoteFreelancer.mutateAsync({ userId })
      } else if (currentRole === "freelancer" && role === "user") {
        await demoteFreelancer.mutateAsync({ userId })
      } else {
        const res = await authClient.admin.setRole({ userId, role })
        if (res.error) throw new Error(res.error.message)
      }
      await refetch()
      toast.success(`Role updated to ${role}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role")
    } finally {
      setSavingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage all clients and their roles.
        </p>
      </div>

      {!users || users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <UsersIcon className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No clients found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-44 text-right">Role</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const role = (u.role as string) ?? "user"
                const isSelf = u.id === session?.user?.id
                return (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                  >
                    <TableCell className="font-medium">
                      {u.name || "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                      )}
                      {u.banned && (
                        <Badge variant="destructive" className="ml-2">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        {isSelf ? (
                          <Badge variant={role === "admin" ? "default" : "outline"}>
                            {role}
                          </Badge>
                        ) : (
                          <MultiSelect
                            single
                            values={[role]}
                            onValuesChange={(vals) => {
                              const next = vals[0]
                              if (next && next !== role) {
                                handleRoleChange(
                                  u.id,
                                  next as "user" | "admin" | "freelancer",
                                  role,
                                )
                              }
                            }}
                          >
                            <MultiSelectTrigger
                              className="h-8 w-36"
                              disabled={savingId === u.id}
                            >
                              <MultiSelectValue />
                            </MultiSelectTrigger>
                            <MultiSelectContent>
                              <MultiSelectItem value="user">User</MultiSelectItem>
                              <MultiSelectItem value="freelancer">
                                Freelancer
                              </MultiSelectItem>
                              <MultiSelectItem value="admin">Admin</MultiSelectItem>
                            </MultiSelectContent>
                          </MultiSelect>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-2">
                        {!isSelf && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleImpersonate(u.id)}
                            disabled={impersonatingId === u.id}
                          >
                            <LogInIcon className="size-3.5" />
                            {impersonatingId === u.id ? "…" : "Impersonate"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/users/${u.id}`)}
                        >
                          View
                          <ArrowRightIcon className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
