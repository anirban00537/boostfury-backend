import { PrismaClient } from '@prisma/client';
import { coreConstant } from '../src/shared/helpers/coreConstant';

const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  console.log('Starting database cleanup...');

  // Delete all existing data in reverse order of dependencies
  await prisma.wordTokenLog.deleteMany({});
  await prisma.postLog.deleteMany({});
  await prisma.linkedInPost.deleteMany({});
  await prisma.linkedInProfile.deleteMany({});
  await prisma.userBranding.deleteMany({});
  await prisma.userVerificationCodes.deleteMany({});
  await prisma.userTokens.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.package.deleteMany({});
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
    },
  });

  // Create Growth Package
  await prisma.package.create({
    data: {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for individual creators',
      type: 'monthly',
      status: 'active',
      price: 19,
      currency: 'USD',
      variantId: '647786',
      productId: '422197',
      featuresList: [
        'Ai Advance Editor',
        'Viral Post maker',
        'Personal Post Writer',
        'Unlimited Post Scheduling',
        '250000 words per month',
        'Priority Support',
        'Custom Branding',
      ],
      monthlyWordLimit: 100000,
    },
  });


  // Create Pro Package
  await prisma.package.create({
    data: {
      id: 'pro',
      name: 'Pro',
      description: 'For power creators and LinkedIn power users',
      type: 'monthly',
      status: 'active',
      price: 49.99,
      currency: 'USD',
      variantId: '680327',
      productId: '441622',

      monthlyWordLimit: 250000,
      featuresList: [
        'Ai Advance Editor',
        'Viral Post maker',
        'Personal Post Writer',
        'Unlimited Post Scheduling',
        '250000 words per month',
        'Priority Support',
        'Custom Branding',
      ],
      features: [1, 2, 3, 4],
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
