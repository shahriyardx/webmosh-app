-- Manual admin status overrides for Stripe / PayPal / Wise, mirroring the
-- existing website_status_override. NULL = follow the live order status.
ALTER TABLE "organization" ADD COLUMN "stripe_status_override" "AccountStatus";
ALTER TABLE "organization" ADD COLUMN "paypal_status_override" "AccountStatus";
ALTER TABLE "organization" ADD COLUMN "wise_status_override" "AccountStatus";

-- The old non-null Stripe/Wise status columns are no longer used (the list now
-- shows the live order status with an optional override).
ALTER TABLE "organization" DROP COLUMN IF EXISTS "stripe_status";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "wise_status";
