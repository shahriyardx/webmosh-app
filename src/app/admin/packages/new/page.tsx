"use client"

import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PackageForm } from "@/components/package-form"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

export default function NewPackagePage() {
  const router = useRouter()
  const utils = trpc.useUtils()

  const createPkg = trpc.packages.create.useMutation({
    onSuccess: () => {
      utils.packages.list.invalidate()
      router.push("/admin/packages")
    },
  })

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
            New Package
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a new formation package.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Package Details</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageForm
            submitLabel="Create Package"
            loading={createPkg.isPending}
            onSubmit={(data) => createPkg.mutate(data)}
            onCancel={() => router.back()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
