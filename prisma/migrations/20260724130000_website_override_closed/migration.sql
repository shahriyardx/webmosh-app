-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'closed';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "website_status_override" "AccountStatus";

