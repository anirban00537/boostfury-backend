import { PrismaClient } from '@prisma/client';
import { coreConstant } from '../src/shared/helpers/coreConstant';

const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  // Delete existing packages
  await prisma.package.deleteMany({});

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

      // Carousel Limits
      carouselLimit: 3,
      carouselSlideLimit: 6,

      // Features
      hasHashtagSuggestions: true,
      aiWriting: true,
      hasScheduling: true,
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
      variantId: '525068',
      productId: '354443',

      // Word Generation Limits
      monthlyWordLimit: 100000,

      // LinkedIn Limits
      linkedInAccountLimit: 2,
      linkedInPostLimit: 60,
      linkedInImageLimit: 4,
      linkedInVideoLimit: 1,

      // Carousel Limits
      carouselLimit: 15,
      carouselSlideLimit: 8,

      // Features
      hasHashtagSuggestions: true,
      aiWriting: true,
      hasScheduling: true,
    },
  });

  // Create Pro Package
  await prisma.package.create({
    data: {
      id: 'pro',
      name: 'Pro',
      description: 'For power users and teams who need more',
      type: 'monthly',
      status: 'active',
      price: 49.99,
      currency: 'USD',
      variantId: '585057',
      productId: '385992',

      // Word Generation Limits
      monthlyWordLimit: 200000,

      // LinkedIn Limits
      linkedInAccountLimit: 5,
      linkedInPostLimit: 200,
      linkedInImageLimit: 8,
      linkedInVideoLimit: 2,

      // Carousel Limits
      carouselLimit: 50,
      carouselSlideLimit: 12,

      // Features
      hasHashtagSuggestions: true,
      aiWriting: true,
      hasScheduling: true,

      // Additional Features
      additionalFeatures: {
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: true,
      },
    },
  });

  // Create Annual Pro Package (20% discount)
  await prisma.package.create({
    data: {
      name: 'Pro Annual',
      description: 'Save 20% with annual billing',
      type: 'yearly',
      status: 'active',
      price: 479.9, // 49.99 * 12 * 0.8 (20% discount)
      currency: 'USD',
      variantId: 'pro_yearly',
      productId: 'pro',

      // Word Generation Limits
      monthlyWordLimit: 100000,

      // LinkedIn Limits
      linkedInAccountLimit: 5,
      linkedInPostLimit: 200,
      linkedInImageLimit: 8,
      linkedInVideoLimit: 2,

      // Carousel Limits
      carouselLimit: 50,
      carouselSlideLimit: 12,

      // Features
      hasHashtagSuggestions: true,
      aiWriting: true,
      hasScheduling: true,

      // Additional Features
      additionalFeatures: {
        prioritySupport: true,
        advancedAnalytics: true,
        customBranding: true,
        priorityQueue: true,
      },
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
