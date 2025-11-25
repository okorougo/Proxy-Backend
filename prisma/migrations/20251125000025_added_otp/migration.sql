/*
  Warnings:

  - A unique constraint covering the columns `[OTP]` on the table `Delivery` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `OTP` to the `Delivery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "OTP" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_OTP_key" ON "Delivery"("OTP");
