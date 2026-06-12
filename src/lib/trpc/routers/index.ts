import { router } from "../server"
import { companiesRouter } from "./companies"
import { packagesRouter } from "./packages"
import { servicesRouter } from "./services"
import { invoicesRouter } from "./invoices"
import { settingsRouter } from "./settings"
import { serviceOrdersRouter } from "./service-orders"

export const appRouter = router({
  companies: companiesRouter,
  packages: packagesRouter,
  services: servicesRouter,
  invoices: invoicesRouter,
  settings: settingsRouter,
  serviceOrders: serviceOrdersRouter,
})

export type AppRouter = typeof appRouter
