import { router } from "../server"
import { companiesRouter } from "./companies"
import { packagesRouter } from "./packages"

export const appRouter = router({
  companies: companiesRouter,
  packages: packagesRouter,
})

export type AppRouter = typeof appRouter
