"use client"

import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { ServiceForm } from "@/components/service-form"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

export default function NewServicePage() {
  const router = useRouter()
  const utils = trpc.useUtils()

  const createSvc = trpc.services.create.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate()
      router.push("/admin/services")
    },
  })

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="size-8">
          <Link href="/admin/services">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            New Service
          </h1>
        </div>
      </div>

      <ServiceForm
        submitLabel="Create Service"
        loading={createSvc.isPending}
        onSubmit={(data) => createSvc.mutate(data)}
        onCancel={() => router.back()}
      />
    </div>
  )
}
