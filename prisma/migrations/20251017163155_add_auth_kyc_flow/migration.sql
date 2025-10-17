/*
  Warnings:

  - You are about to drop the `Kyc` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Kyc" DROP CONSTRAINT "Kyc_userId_fkey";

-- DropTable
DROP TABLE "public"."Kyc";

-- CreateTable
CREATE TABLE "public"."KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nin" TEXT,
    "selfieUrl" TEXT,
    "idCardUrl" TEXT,
    "status" "public"."KycStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_userId_key" ON "public"."KycVerification"("userId");

-- AddForeignKey
ALTER TABLE "public"."KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
