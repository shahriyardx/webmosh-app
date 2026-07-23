-- CreateTable
CREATE TABLE "exchange_transaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "from_account" TEXT NOT NULL,
    "to_account" TEXT NOT NULL,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_transaction_date_idx" ON "exchange_transaction"("date");

-- CreateIndex
CREATE INDEX "exchange_transaction_to_account_idx" ON "exchange_transaction"("to_account");

