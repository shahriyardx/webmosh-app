import { router } from "../server"
import { companiesRouter } from "./companies"
import { packagesRouter } from "./packages"
import { servicesRouter } from "./services"

export const appRouter = router({
  companies: companiesRouter,
  packages: packagesRouter,
  services: servicesRouter,
})

export type AppRouter = typeof appRouter
