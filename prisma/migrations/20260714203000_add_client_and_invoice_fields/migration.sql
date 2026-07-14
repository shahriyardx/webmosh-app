-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "items" JSONB,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "receiver_email" TEXT,
ADD COLUMN     "receiver_name" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoice_number_key" ON "invoice"("number");
