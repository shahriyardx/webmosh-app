-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
