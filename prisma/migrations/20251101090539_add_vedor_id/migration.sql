/*
  Warnings:

  - The `status` column on the `Rider` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."RiderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_sellerId_fkey";

-- AlterTable
ALTER TABLE "public"."Rider" DROP COLUMN "status",
ADD COLUMN     "status" "public"."RiderStatus" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."VendorApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
