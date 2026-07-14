"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { ServiceForm } from "@/components/service-form"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

export default function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: svc, isLoading } = trpc.services.getById.useQuery({ id })

  const updateSvc = trpc.services.update.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate()
      router.push("/admin/services")
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-5 animate-pulse rounded-full bg-sky-500/50" />
      </div>
    )
  }

  if (!svc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Service not found.</p>
      </div>
    )
  }

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
            Edit Service
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{svc.title}</p>
        </div>
      </div>

      <ServiceForm
        defaultValues={{
          title: svc.title,
          description: svc.description,
          features: svc.features.map((f) => ({ value: f })),
          price: String(svc.price),
          country: svc.country as "us" | "uk",
        }}
        loading={updateSvc.isPending}
        onSubmit={(data) => updateSvc.mutate({ id, ...data })}
        onCancel={() => router.push("/admin/services")}
      />
    </div>
  )
}
