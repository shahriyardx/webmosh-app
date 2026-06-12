-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'processing', 'paid', 'rejected');

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT,
    "transaction_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "reject_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_organizationId_idx" ON "invoice"("organizationId");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
