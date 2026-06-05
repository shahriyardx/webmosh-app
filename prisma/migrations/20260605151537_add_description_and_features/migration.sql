/*
  Warnings:

  - Added the required column `description` to the `package` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "package" ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "service" ADD COLUMN     "features" TEXT[];
