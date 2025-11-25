-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "vendorWalletId" TEXT;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_vendorWalletId_fkey" FOREIGN KEY ("vendorWalletId") REFERENCES "VendorWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
