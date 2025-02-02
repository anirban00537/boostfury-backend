/*
  Warnings:

  - You are about to drop the column `additionalFeatures` on the `Package` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Package" DROP COLUMN "additionalFeatures",
ADD COLUMN     "features" INTEGER[],
ADD COLUMN     "featuresList" TEXT[];

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "features" INTEGER[];
