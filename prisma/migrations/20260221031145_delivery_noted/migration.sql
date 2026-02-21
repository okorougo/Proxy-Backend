-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "isSelfDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendorLat" DOUBLE PRECISION,
ADD COLUMN     "vendorLng" DOUBLE PRECISION,
ADD COLUMN     "vendorStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "isRenderedService" BOOLEAN NOT NULL DEFAULT false;
