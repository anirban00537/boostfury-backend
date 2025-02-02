/*
  Warnings:

  - You are about to drop the column `aiStudio` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInAccountLimit` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInImageLimit` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInPostLimit` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInVideoLimit` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `postIdeaGenerator` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `viralPostGeneration` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `lastPostResetDate` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInAccountLimit` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInAccountsUsed` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInPostLimit` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `linkedInPostsUsed` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `nextPostResetDate` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Package" DROP COLUMN "aiStudio",
DROP COLUMN "linkedInAccountLimit",
DROP COLUMN "linkedInImageLimit",
DROP COLUMN "linkedInPostLimit",
DROP COLUMN "linkedInVideoLimit",
DROP COLUMN "postIdeaGenerator",
DROP COLUMN "viralPostGeneration";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "lastPostResetDate",
DROP COLUMN "linkedInAccountLimit",
DROP COLUMN "linkedInAccountsUsed",
DROP COLUMN "linkedInPostLimit",
DROP COLUMN "linkedInPostsUsed",
DROP COLUMN "nextPostResetDate";
