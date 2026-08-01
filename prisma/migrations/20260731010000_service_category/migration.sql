-- AlterTable: optional service category (stripe | paypal | wise)
ALTER TABLE "service" ADD COLUMN "category" TEXT;
