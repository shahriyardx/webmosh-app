"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { trpc } from "@/lib/trpc/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  PackageFormFields,
  PackageFormActions,
  packageFormSchema,
  packageFormDefaults,
  type PackageForm,
} from "@/components/package-form"
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

  const form = useForm<PackageForm>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: packageFormDefaults,
  })

  const onSubmit = (data: PackageForm) => {
    createPkg.mutate({
      title: data.title,
      country: data.country,
      features: data.features.split(",").map((f) => f.trim()).filter(Boolean),
      price: parseInt(data.price, 10),
    })
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <PackageFormFields form={form} />
            <PackageFormActions
              loading={createPkg.isPending}
              submitLabel="Create Package"
              onCancel={() => router.back()}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
