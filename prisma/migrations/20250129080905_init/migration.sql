-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "user_name" VARCHAR(255),
    "unique_code" VARCHAR(255),
    "phone" VARCHAR(180),
    "photo" VARCHAR(500),
    "country" VARCHAR(180),
    "birth_date" TIMESTAMP(3),
    "role" SMALLINT NOT NULL DEFAULT 2,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "is_subscribed" SMALLINT NOT NULL DEFAULT 0,
    "email_verified" SMALLINT NOT NULL DEFAULT 0,
    "phone_verified" SMALLINT NOT NULL DEFAULT 0,
    "gender" SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "login_provider" VARCHAR(50) NOT NULL,
    "linkedin_id" VARCHAR(255),
    "linkedin_access_token" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "clientId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "linkedInProfileUrl" TEXT,
    "tokenExpiringAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "professionalIdentity" TEXT,
    "contentTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "postType" TEXT NOT NULL DEFAULT 'text',
    "videoUrl" TEXT,
    "documentUrl" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledTime" TIMESTAMP(3),
    "status" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedId" TEXT,
    "linkedInApiResponse" JSONB,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileUrl" TEXT,
    "publishingError" TEXT,
    "carouselTitle" TEXT,
    "videoTitle" TEXT,
    "publishingErrorCode" TEXT,
    "userId" TEXT NOT NULL,
    "linkedInProfileId" TEXT NOT NULL,

    CONSTRAINT "LinkedInPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLog" (
    "id" TEXT NOT NULL,
    "linkedInPostId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "family" VARCHAR(255) NOT NULL,
    "browserInfo" VARCHAR(255),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "monthlyWordLimit" INTEGER NOT NULL,
    "linkedInAccountLimit" INTEGER NOT NULL DEFAULT 1,
    "linkedInPostLimit" INTEGER NOT NULL DEFAULT 30,
    "linkedInImageLimit" INTEGER NOT NULL DEFAULT 4,
    "linkedInVideoLimit" INTEGER NOT NULL DEFAULT 1,
    "viralPostGeneration" BOOLEAN NOT NULL DEFAULT true,
    "aiStudio" BOOLEAN NOT NULL DEFAULT false,
    "postIdeaGenerator" BOOLEAN NOT NULL DEFAULT false,
    "additionalFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "orderId" TEXT,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "monthlyWordLimit" INTEGER NOT NULL DEFAULT 0,
    "wordsGenerated" INTEGER NOT NULL DEFAULT 0,
    "wordsAllowedInTrial" INTEGER,
    "lastWordResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextWordResetDate" TIMESTAMP(3) NOT NULL,
    "subscriptionId" TEXT,
    "linkedInAccountLimit" INTEGER NOT NULL DEFAULT 1,
    "linkedInAccountsUsed" INTEGER NOT NULL DEFAULT 0,
    "linkedInPostLimit" INTEGER NOT NULL DEFAULT -1,
    "linkedInPostsUsed" INTEGER NOT NULL DEFAULT 0,
    "lastPostResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextPostResetDate" TIMESTAMP(3) NOT NULL,
    "viralPostGeneration" BOOLEAN NOT NULL DEFAULT true,
    "aiStudio" BOOLEAN NOT NULL DEFAULT false,
    "postIdeaGenerator" BOOLEAN NOT NULL DEFAULT false,
    "billingCycle" TEXT,
    "renewalPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "customFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordTokenLog" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordTokenLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBranding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "headshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVerificationCodes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "type" SMALLINT NOT NULL DEFAULT 1,
    "expired_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVerificationCodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInPostImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTimeSlot" (
    "id" TEXT NOT NULL,
    "linkedInProfileId" TEXT NOT NULL,
    "monday" JSONB[],
    "tuesday" JSONB[],
    "wednesday" JSONB[],
    "thursday" JSONB[],
    "friday" JSONB[],
    "saturday" JSONB[],
    "sunday" JSONB[],
    "postsPerDay" INTEGER NOT NULL DEFAULT 2,
    "minTimeGap" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueuedPost" (
    "id" TEXT NOT NULL,
    "linkedInProfileId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "queueOrder" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueuedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_user_name_key" ON "User"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "User_unique_code_key" ON "User"("unique_code");

-- CreateIndex
CREATE UNIQUE INDEX "User_linkedin_id_key" ON "User"("linkedin_id");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInProfile_profileId_key" ON "LinkedInProfile"("profileId");

-- CreateIndex
CREATE INDEX "LinkedInProfile_userId_idx" ON "LinkedInProfile"("userId");

-- CreateIndex
CREATE INDEX "LinkedInPost_userId_idx" ON "LinkedInPost"("userId");

-- CreateIndex
CREATE INDEX "LinkedInPost_linkedInProfileId_idx" ON "LinkedInPost"("linkedInProfileId");

-- CreateIndex
CREATE INDEX "PostLog_linkedInPostId_idx" ON "PostLog"("linkedInPostId");

-- CreateIndex
CREATE INDEX "UserTokens_userId_idx" ON "UserTokens"("userId");

-- CreateIndex
CREATE INDEX "UserTokens_refreshToken_idx" ON "UserTokens"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "Package_variantId_key" ON "Package"("variantId");

-- CreateIndex
CREATE INDEX "Package_status_idx" ON "Package"("status");

-- CreateIndex
CREATE INDEX "Package_type_idx" ON "Package"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_orderId_key" ON "Subscription"("orderId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_packageId_idx" ON "Subscription"("packageId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");

-- CreateIndex
CREATE INDEX "Subscription_isTrial_idx" ON "Subscription"("isTrial");

-- CreateIndex
CREATE INDEX "WordTokenLog_subscriptionId_idx" ON "WordTokenLog"("subscriptionId");

-- CreateIndex
CREATE INDEX "WordTokenLog_type_idx" ON "WordTokenLog"("type");

-- CreateIndex
CREATE INDEX "WordTokenLog_createdAt_idx" ON "WordTokenLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranding_userId_key" ON "UserBranding"("userId");

-- CreateIndex
CREATE INDEX "UserBranding_userId_idx" ON "UserBranding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVerificationCodes_code_key" ON "UserVerificationCodes"("code");

-- CreateIndex
CREATE INDEX "UserVerificationCodes_userId_idx" ON "UserVerificationCodes"("userId");

-- CreateIndex
CREATE INDEX "LinkedInPostImage_postId_idx" ON "LinkedInPostImage"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostTimeSlot_linkedInProfileId_key" ON "PostTimeSlot"("linkedInProfileId");

-- CreateIndex
CREATE INDEX "PostTimeSlot_linkedInProfileId_idx" ON "PostTimeSlot"("linkedInProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "QueuedPost_postId_key" ON "QueuedPost"("postId");

-- CreateIndex
CREATE INDEX "QueuedPost_linkedInProfileId_idx" ON "QueuedPost"("linkedInProfileId");

-- CreateIndex
CREATE INDEX "QueuedPost_postId_idx" ON "QueuedPost"("postId");
