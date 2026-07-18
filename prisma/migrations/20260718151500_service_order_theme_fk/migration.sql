-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "service_order_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
