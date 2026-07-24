"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  BellIcon,
  Building2Icon,
  ShoppingCartIcon,
  ReceiptIcon,
  LifeBuoyIcon,
  WalletIcon,
  FileTextIcon,
  UserPlusIcon,
  InboxIcon,
  CheckCheckIcon,
  MessagesSquareIcon,
  ClipboardCheckIcon,
} from "lucide-react"

const kindIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "formation.created": Building2Icon,
  "formation.imported": Building2Icon,
  "order.placed": ShoppingCartIcon,
  "order.quoted": ShoppingCartIcon,
  "invoice.payment_submitted": ReceiptIcon,
  "invoice.paid": ReceiptIcon,
  "ticket.created": LifeBuoyIcon,
  "payout.requested": WalletIcon,
  "document.submitted": FileTextIcon,
  "user.signup": UserPlusIcon,
  "wallet.topup_submitted": WalletIcon,
  "wallet.payout_requested": WalletIcon,
  "discussion.message": MessagesSquareIcon,
  "task.submitted": ClipboardCheckIcon,
  "exchange.submitted": ReceiptIcon,
}

const kindColors: Record<string, string> = {
  "formation.created": "bg-sky-500/15 text-sky-500",
  "formation.imported": "bg-sky-500/15 text-sky-500",
  "order.placed": "bg-emerald-500/15 text-emerald-500",
  "order.quoted": "bg-emerald-500/15 text-emerald-500",
  "invoice.payment_submitted": "bg-amber-500/15 text-amber-500",
  "invoice.paid": "bg-emerald-500/15 text-emerald-500",
  "ticket.created": "bg-red-500/15 text-red-500",
  "payout.requested": "bg-purple-500/15 text-purple-500",
  "document.submitted": "bg-sky-500/15 text-sky-500",
  "user.signup": "bg-muted text-muted-foreground",
  "wallet.topup_submitted": "bg-amber-500/15 text-amber-500",
  "wallet.payout_requested": "bg-purple-500/15 text-purple-500",
  "discussion.message": "bg-sky-500/15 text-sky-500",
  "task.submitted": "bg-emerald-500/15 text-emerald-500",
  "exchange.submitted": "bg-amber-500/15 text-amber-500",
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return date.toLocaleDateString()
}

export function NotificationBell() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data: notifications } = trpc.notifications.list.useQuery(
    { limit: 30 },
    {
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  )
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(
    undefined,
    {
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  )

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate()
      utils.notifications.unreadCount.invalidate()
    },
  })

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate()
      utils.notifications.unreadCount.invalidate()
      toast.success("All notifications marked read")
    },
  })

  const handleClick = (n: {
    id: string
    link: string | null
    readAt: Date | null
  }) => {
    if (!n.readAt) {
      markRead.mutate({ id: n.id })
    }
    if (n.link) {
      router.push(n.link)
    }
  }

  const count = unreadCount ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          title="Notifications"
        >
          <BellIcon className="size-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <p className="text-xs text-muted-foreground">
                {count} unread
              </p>
            )}
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="inline-flex items-center gap-1 text-xs text-sky-500 hover:underline disabled:opacity-50"
            >
              <CheckCheckIcon className="size-3" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {!notifications?.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <InboxIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const Icon = kindIcons[n.kind] ?? BellIcon
                const color =
                  kindColors[n.kind] ?? "bg-muted text-muted-foreground"
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      !n.readAt ? "bg-sky-500/5" : ""
                    }`}
                  >
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${color}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {timeAgo(new Date(n.createdAt))}
                      </p>
                    </div>
                    {!n.readAt && (
                      <span className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-sky-500" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {notifications && notifications.length > 0 && (
          <div className="border-t border-border p-2">
            <Link
              href="/admin"
              className="block rounded-md px-3 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted"
            >
              Showing latest {notifications.length}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
