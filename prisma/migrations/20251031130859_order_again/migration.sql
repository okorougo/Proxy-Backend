/*
  Warnings:

  - Added the required column `transactionId` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPrice` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."OrderItem" ADD COLUMN     "transactionId" TEXT NOT NULL,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
