-- CreateEnum
CREATE TYPE "ExchangeTxStatus" AS ENUM ('pending', 'approved');

-- AlterTable
ALTER TABLE "exchange_transaction" ADD COLUMN     "status" "ExchangeTxStatus" NOT NULL DEFAULT 'approved',
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "exchange_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "exchange_transaction_user_id_idx" ON "exchange_transaction"("user_id");

-- AddForeignKey
ALTER TABLE "exchange_transaction" ADD CONSTRAINT "exchange_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

