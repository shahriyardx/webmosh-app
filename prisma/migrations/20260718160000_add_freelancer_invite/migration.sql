-- CreateTable
CREATE TABLE "freelancer_invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freelancer_invite_email_idx" ON "freelancer_invite"("email");

-- AddForeignKey
ALTER TABLE "freelancer_invite" ADD CONSTRAINT "freelancer_invite_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
