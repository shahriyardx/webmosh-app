-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('topup', 'payout', 'invoice_payment');

-- CreateEnum
CREATE TYPE "WalletTxStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "wallet_transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "status" "WalletTxStatus" NOT NULL DEFAULT 'pending',
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "transaction_id" TEXT,
    "bank_details" JSONB,
    "invoice_id" TEXT,
    "note" TEXT,
    "admin_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_transaction_user_id_idx" ON "wallet_transaction"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transaction_status_idx" ON "wallet_transaction"("status");

-- CreateIndex
CREATE INDEX "wallet_transaction_type_idx" ON "wallet_transaction"("type");

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

