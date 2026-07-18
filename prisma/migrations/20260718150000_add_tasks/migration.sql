-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'blocked', 'done');

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "deadline" TIMESTAMP(3),
    "assigned_to_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "organization_id" TEXT,
    "order_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assigned_to_id_idx" ON "task"("assigned_to_id");

-- CreateIndex
CREATE INDEX "task_status_idx" ON "task"("status");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "service_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
