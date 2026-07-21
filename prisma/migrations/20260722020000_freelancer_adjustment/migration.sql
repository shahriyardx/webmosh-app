-- CreateTable
CREATE TABLE "freelancer_adjustment" (
    "id" TEXT NOT NULL,
    "freelancer_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freelancer_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freelancer_adjustment_freelancer_id_idx" ON "freelancer_adjustment"("freelancer_id");

-- AddForeignKey
ALTER TABLE "freelancer_adjustment" ADD CONSTRAINT "freelancer_adjustment_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

