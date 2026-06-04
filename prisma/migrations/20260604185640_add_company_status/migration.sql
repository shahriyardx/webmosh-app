-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('pending', 'processing', 'rejected');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "status" "CompanyStatus" NOT NULL DEFAULT 'pending';
