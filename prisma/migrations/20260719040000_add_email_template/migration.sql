-- CreateTable
CREATE TABLE "email_template" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "cta_label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_template_event_key" ON "email_template"("event");

