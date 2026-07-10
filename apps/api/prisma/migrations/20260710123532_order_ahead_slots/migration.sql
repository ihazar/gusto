-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "availabilityId" TEXT,
ADD COLUMN     "scheduledDate" TEXT,
ADD COLUMN     "slotEnd" TEXT,
ADD COLUMN     "slotStart" TEXT;

-- CreateIndex
CREATE INDEX "Order_availabilityId_scheduledDate_idx" ON "Order"("availabilityId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "Availability"("id") ON DELETE SET NULL ON UPDATE CASCADE;
