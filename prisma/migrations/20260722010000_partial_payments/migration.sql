-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'partially_paid';

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE 'external_payment';

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0;

