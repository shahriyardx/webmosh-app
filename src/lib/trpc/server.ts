import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { auth } from "../auth"
import { headers } from "next/headers"

export async function createTRPCContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  return {
    session,
    user: session?.user ?? null,
  }
}

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create({
    transformer: superjson,
  })

export const router = t.router
export const publicProcedure = t.procedure

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" })
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  })
})

export const adminProcedure = t.procedure.use(enforceUserIsAdmin)
