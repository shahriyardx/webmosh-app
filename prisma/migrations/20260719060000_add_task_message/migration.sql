-- CreateTable
CREATE TABLE "task_message" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "from_admin" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "attachments" TEXT[],
    "read_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "read_by_freelancer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_message_task_id_idx" ON "task_message"("task_id");

-- AddForeignKey
ALTER TABLE "task_message" ADD CONSTRAINT "task_message_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_message" ADD CONSTRAINT "task_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

