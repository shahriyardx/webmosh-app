-- CreateTable
CREATE TABLE "extracted_document" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "file_url" TEXT,
    "organization_id" TEXT,
    "service_order_id" TEXT,
    "client_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_by_id" TEXT,
    "created_by_email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extracted_document_organization_id_idx" ON "extracted_document"("organization_id");

-- CreateIndex
CREATE INDEX "extracted_document_service_order_id_idx" ON "extracted_document"("service_order_id");

-- CreateIndex
CREATE INDEX "extracted_document_status_idx" ON "extracted_document"("status");
