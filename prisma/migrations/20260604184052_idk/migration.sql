/*
  Warnings:

  - The `status` column on the `document` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('submitted', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "document" DROP COLUMN "status",
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'submitted';
