import { router } from "../server"
import { companiesRouter } from "./companies"
import { packagesRouter } from "./packages"
import { servicesRouter } from "./services"
import { invoicesRouter } from "./invoices"
import { settingsRouter } from "./settings"
import { serviceOrdersRouter } from "./service-orders"
import { mailsRouter } from "./mails"
import { ticketsRouter } from "./tickets"
import { themesRouter } from "./themes"
import { freelancersRouter } from "./freelancers"
import { tasksRouter } from "./tasks"
import { payoutsRouter } from "./payouts"
import { notificationsRouter } from "./notifications"
import { emailsRouter } from "./emails"
import { walletRouter } from "./wallet"
import { discussionsRouter } from "./discussions"
import { bankAccountsRouter } from "./bank-accounts"
import { couponsRouter } from "./coupons"
import { exchangeRouter } from "./exchange"
import { adminRouter } from "./admin"

export const appRouter = router({
  companies: companiesRouter,
  packages: packagesRouter,
  services: servicesRouter,
  invoices: invoicesRouter,
  settings: settingsRouter,
  serviceOrders: serviceOrdersRouter,
  mails: mailsRouter,
  tickets: ticketsRouter,
  themes: themesRouter,
  freelancers: freelancersRouter,
  tasks: tasksRouter,
  payouts: payoutsRouter,
  notifications: notificationsRouter,
  emails: emailsRouter,
  wallet: walletRouter,
  discussions: discussionsRouter,
  bankAccounts: bankAccountsRouter,
  coupons: couponsRouter,
  exchange: exchangeRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
