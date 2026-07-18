-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "payout" (
    "id" TEXT NOT NULL,
    "freelancer_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL,
    "bank_details" JSONB NOT NULL,
    "note" TEXT,
    "admin_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payout_freelancer_id_idx" ON "payout"("freelancer_id");

-- CreateIndex
CREATE INDEX "payout_status_idx" ON "payout"("status");

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
