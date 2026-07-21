-- AlterTable
ALTER TABLE "task" ADD COLUMN     "delivery_note" TEXT,
ADD COLUMN     "delivery_note_included" BOOLEAN NOT NULL DEFAULT false;

