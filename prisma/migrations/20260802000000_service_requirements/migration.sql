-- AlterTable: service requirements (extra items the customer must provide)
ALTER TABLE "service" ADD COLUMN "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "service_order" ADD COLUMN "requirement_values" JSONB;
