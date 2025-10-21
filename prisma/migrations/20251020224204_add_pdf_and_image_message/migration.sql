-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "messageType" TEXT NOT NULL DEFAULT 'TEXT';
