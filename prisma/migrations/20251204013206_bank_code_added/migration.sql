/*
  Warnings:

  - Added the required column `bankCode` to the `WithdrawalRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN     "bankCode" TEXT NOT NULL;
