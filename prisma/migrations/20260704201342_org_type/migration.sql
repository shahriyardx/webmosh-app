-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('company', 'personal');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "type" "OrganizationType" NOT NULL DEFAULT 'company';
