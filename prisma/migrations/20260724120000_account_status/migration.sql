-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('not_started', 'pending', 'active', 'rejected');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "stripe_status" "AccountStatus" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "wise_status" "AccountStatus" NOT NULL DEFAULT 'not_started';

