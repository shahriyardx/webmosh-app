-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'in_review';

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "revision_note" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

