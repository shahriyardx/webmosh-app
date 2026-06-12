-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('pending', 'processing', 'completed');

-- AlterTable
ALTER TABLE "service_order" ADD COLUMN     "status" "ServiceOrderStatus" NOT NULL DEFAULT 'pending';
