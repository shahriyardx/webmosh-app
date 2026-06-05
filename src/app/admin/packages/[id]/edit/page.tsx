"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PackageForm } from "@/components/package-form"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

export default function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: pkg, isLoading } = trpc.packages.getById.useQuery({ id })

  const updatePkg = trpc.packages.update.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate()
      router.push("/admin/packages")
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-amber-500/50" />
      </div>
    )
  }

  if (!pkg) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Package not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="size-8">
          <Link href="/admin/packages">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Edit Package
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{pkg.title}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Package Details</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageForm
            defaultValues={{
              title: pkg.title,
              country: pkg.country as "us" | "uk",
              features: pkg.features.join(", "),
              price: String(pkg.price),
            }}
            loading={updatePkg.isPending}
            onSubmit={(data) => updatePkg.mutate({ id, ...data })}
            onCancel={() => router.push("/admin/packages")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
