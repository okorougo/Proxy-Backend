/*
  Warnings:

  - You are about to drop the column `price` on the `OrderItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."OrderItem" DROP CONSTRAINT "OrderItem_transactionId_fkey";

-- AlterTable
ALTER TABLE "public"."OrderItem" DROP COLUMN "price",
ALTER COLUMN "transactionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
