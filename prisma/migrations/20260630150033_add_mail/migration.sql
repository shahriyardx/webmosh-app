-- CreateTable
CREATE TABLE "mail" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_organizationId_idx" ON "mail"("organizationId");

-- AddForeignKey
ALTER TABLE "mail" ADD CONSTRAINT "mail_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
