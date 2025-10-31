-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_listingId_fkey";

-- AlterTable
ALTER TABLE "public"."Transaction" ALTER COLUMN "listingId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
