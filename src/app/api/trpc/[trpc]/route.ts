import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import type { NextRequest } from "next/server"
import { appRouter } from "@/lib/trpc/routers"
import { createTRPCContext } from "@/lib/trpc/server"

const handler = (request: NextRequest) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext(),
  })
}

export { handler as GET, handler as POST }
