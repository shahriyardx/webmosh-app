-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('general', 'wordpress');

-- AlterEnum
ALTER TYPE "ServiceOrderStatus" ADD VALUE 'awaiting_quote';

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "type" "ServiceType" NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE "service_order" ADD COLUMN     "credentials" JSONB,
ADD COLUMN     "custom_design_url" TEXT,
ADD COLUMN     "theme_id" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "theme" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "demo_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);
