import { router } from "../server"
import { companiesRouter } from "./companies"
import { packagesRouter } from "./packages"
import { servicesRouter } from "./services"
import { invoicesRouter } from "./invoices"

export const appRouter = router({
  companies: companiesRouter,
  packages: packagesRouter,
  services: servicesRouter,
  invoices: invoicesRouter,
})

export type AppRouter = typeof appRouter
