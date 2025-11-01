-- DropForeignKey
ALTER TABLE "public"."Delivery" DROP CONSTRAINT "Delivery_riderId_fkey";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "riderId" TEXT;

-- CreateTable
CREATE TABLE "public"."Rider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "vehicleType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RiderKyc" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "ninNumber" TEXT NOT NULL,
    "selfieUrl" TEXT NOT NULL,
    "idCardUrl" TEXT,
    "idType" TEXT NOT NULL DEFAULT 'NIN',
    "licenseUrl" TEXT,
    "roadWorthinessUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderKyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RiderVehicle" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plateNumber" TEXT,
    "frontViewUrl" TEXT,
    "backViewUrl" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rider_userId_key" ON "public"."Rider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderKyc_riderId_key" ON "public"."RiderKyc"("riderId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderVehicle_riderId_key" ON "public"."RiderVehicle"("riderId");

-- AddForeignKey
ALTER TABLE "public"."Delivery" ADD CONSTRAINT "Delivery_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "public"."Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rider" ADD CONSTRAINT "Rider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiderKyc" ADD CONSTRAINT "RiderKyc_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "public"."Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RiderVehicle" ADD CONSTRAINT "RiderVehicle_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "public"."Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
