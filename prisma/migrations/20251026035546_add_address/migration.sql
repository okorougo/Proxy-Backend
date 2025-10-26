/*
  Warnings:

  - You are about to drop the column `locationId` on the `VendorApplication` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[vendorId]` on the table `Location` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."VendorApplication" DROP CONSTRAINT "VendorApplication_locationId_fkey";

-- AlterTable
ALTER TABLE "public"."Location" ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "public"."VendorApplication" DROP COLUMN "locationId";

-- CreateIndex
CREATE UNIQUE INDEX "Location_vendorId_key" ON "public"."Location"("vendorId");

-- AddForeignKey
ALTER TABLE "public"."Location" ADD CONSTRAINT "Location_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."VendorApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
