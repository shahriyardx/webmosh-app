-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "ticket_organizationId_idx" ON "ticket"("organizationId");

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
