import { PrismaClient } from '@prisma/client';
import { coreConstant } from '../src/shared/helpers/coreConstant';

const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  console.log('Starting database cleanup...');

  // Delete all existing data in reverse order of dependencies
  await prisma.wordTokenLog.deleteMany({});
  await prisma.postLog.deleteMany({});
  await prisma.queuedPost.deleteMany({});
  await prisma.linkedInPost.deleteMany({});
  await prisma.linkedInProfile.deleteMany({});
  await prisma.carousel.deleteMany({});
  await prisma.userBranding.deleteMany({});
  await prisma.userVerificationCodes.deleteMany({});
  await prisma.userTokens.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleanup completed');
  console.log('Starting to seed packages...');

  // Create Trial Package
  await prisma.package.create({
    data: {
      id: 'trial',
      name: 'Trial',
      description: 'Try our platform for free',
      type: coreConstant.PACKAGE_TYPE.TRIAL,
      status: 'active',
      price: 0,
      currency: 'USD',
      variantId: 'trial',
      productId: 'trial',

      // Word Generation Limits
      monthlyWordLimit: 5000,

      // LinkedIn Limits
      linkedInAccountLimit: 1,
      linkedInPostLimit: 10,
      linkedInImageLimit: 2,
      linkedInVideoLimit: 0,

      // Features
      viralPostGeneration: true,
      aiStudio: true,
      postIdeaGenerator: true,
    },
  });

  // Create Growth Package
  await prisma.package.create({
    data: {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for growing professionals and small businesses',
      type: 'monthly',
      status: 'active',
      price: 19,
      currency: 'USD',
      variantId: 'pri_01jeh3nyba849cqc2yvb1ha8a7',
      productId: 'starter_' + Date.now(),

      // Word Generation Limits
      monthlyWordLimit: 100000,

      // LinkedIn Limits
      linkedInAccountLimit: 2,
      linkedInPostLimit: 60,
      linkedInImageLimit: 4,
      linkedInVideoLimit: 1,

      // Features
      viralPostGeneration: true,
      aiStudio: true,
      postIdeaGenerator: true,
    },
  });
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
