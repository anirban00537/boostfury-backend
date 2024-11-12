/*
  Warnings:

  - You are about to drop the column `aiPrompt` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `comments` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `creditCost` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `impressions` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `isAIGenerated` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `likes` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `linkDescription` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `linkThumbnail` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `linkTitle` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `linkUrl` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `pollDurationHours` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `pollOptions` on the `LinkedInPost` table. All the data in the column will be lost.
  - You are about to drop the column `shares` on the `LinkedInPost` table. All the data in the column will be lost.
  - The `status` column on the `LinkedInPost` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `creditBalance` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `CreditTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserWorkspaces` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `workspaceId` on table `Carousel` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workspaceId` on table `LinkedInPost` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `clientId` to the `LinkedInProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creatorId` to the `LinkedInProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `LinkedInProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `LinkedInProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenExpiringAt` to the `LinkedInProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Carousel" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LinkedInPost" DROP COLUMN "aiPrompt",
DROP COLUMN "comments",
DROP COLUMN "creditCost",
DROP COLUMN "impressions",
DROP COLUMN "isAIGenerated",
DROP COLUMN "likes",
DROP COLUMN "linkDescription",
DROP COLUMN "linkThumbnail",
DROP COLUMN "linkTitle",
DROP COLUMN "linkUrl",
DROP COLUMN "pollDurationHours",
DROP COLUMN "pollOptions",
DROP COLUMN "shares",
ADD COLUMN     "carouselTitle" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "linkedInApiResponse" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedId" TEXT,
ADD COLUMN     "publishingError" TEXT,
ADD COLUMN     "publishingErrorCode" TEXT,
ADD COLUMN     "videoTitle" TEXT,
ALTER COLUMN "scheduledTime" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "hashtags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "mentions" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LinkedInProfile" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "creatorId" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "linkedInProfileUrl" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "tokenExpiringAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "creditBalance";

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "CreditTransaction";

-- DropTable
DROP TABLE "_UserWorkspaces";

-- CreateTable
CREATE TABLE "AIWordUsage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalWordLimit" INTEGER NOT NULL DEFAULT 0,
    "wordsGenerated" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIWordUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserToWorkspace" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AIWordUsage_userId_key" ON "AIWordUsage"("userId");

-- CreateIndex
CREATE INDEX "AIWordUsage_userId_idx" ON "AIWordUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_UserToWorkspace_AB_unique" ON "_UserToWorkspace"("A", "B");

-- CreateIndex
CREATE INDEX "_UserToWorkspace_B_index" ON "_UserToWorkspace"("B");

-- CreateIndex
CREATE INDEX "LinkedInProfile_workspaceId_idx" ON "LinkedInProfile"("workspaceId");
