/*
  Warnings:

  - You are about to drop the column `aiStudio` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `customFeatures` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `postIdeaGenerator` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `viralPostGeneration` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "aiStudio",
DROP COLUMN "customFeatures",
DROP COLUMN "postIdeaGenerator",
DROP COLUMN "viralPostGeneration";
