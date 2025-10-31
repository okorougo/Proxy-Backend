/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `Delivery` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderId` to the `Delivery` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `DigitalFile` table without a default value. This is not possible if the table is not empty.
  - Made the column `vendorId` on table `Location` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `orderId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Location" DROP CONSTRAINT "Location_vendorId_fkey";

-- AlterTable
ALTER TABLE "public"."Delivery" ADD COLUMN     "digitalFiles" JSONB,
ADD COLUMN     "isDigital" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."DigitalFile" ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Location" ALTER COLUMN "vendorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "orderId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDigital" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "public"."Delivery"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_orderId_key" ON "public"."Transaction"("orderId");

-- AddForeignKey
ALTER TABLE "public"."Location" ADD CONSTRAINT "Location_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."VendorApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "public"."VendorApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
