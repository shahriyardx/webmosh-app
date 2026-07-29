-- AlterTable: US LLC (manually imported existing company) details
ALTER TABLE "organization" ADD COLUMN "state" TEXT;
ALTER TABLE "organization" ADD COLUMN "registered_address" TEXT;
ALTER TABLE "organization" ADD COLUMN "ein" TEXT;
