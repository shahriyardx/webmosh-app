-- The exchange fee only applies to transactions dated on/after this day.
ALTER TABLE "user" ADD COLUMN "exchange_fee_start_date" TIMESTAMP(3);
