-- Per-client exchange fee percentage.
ALTER TABLE "user" ADD COLUMN "exchange_fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Per-transaction fee snapshot + monthly fee-withdrawal marker (shown in red).
ALTER TABLE "exchange_transaction" ADD COLUMN "fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "exchange_transaction" ADD COLUMN "is_fee" BOOLEAN NOT NULL DEFAULT false;
