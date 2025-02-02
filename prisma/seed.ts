import { PrismaClient } from '@prisma/client';
import { coreConstant } from '../src/shared/helpers/coreConstant';
import { hashedPassword } from '../src/shared/helpers/functions';
import { LOGIN_PROVIDER } from '../src/shared/constants/global.constants';

const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  await prisma.package.deleteMany({});
  await prisma.user.createMany({
    data: [
      {
        email: 'admin@email.com',
        password: (
          await hashedPassword(coreConstant.COMMON_PASSWORD)
        ).toString(),
        first_name: 'Mr',
        last_name: 'Admin',
        user_name: 'admin',
        role: coreConstant.USER_ROLE_ADMIN,
        status: coreConstant.STATUS_ACTIVE,
        email_verified: coreConstant.IS_VERIFIED,
        login_provider: LOGIN_PROVIDER.EMAIL,
      },
      {
        email: 'user@email.com',
        password: (
          await hashedPassword(coreConstant.COMMON_PASSWORD)
        ).toString(),
        first_name: 'Mr',
        last_name: 'User',
        user_name: 'user',
        role: coreConstant.USER_ROLE_USER,
        status: coreConstant.STATUS_ACTIVE,
        email_verified: coreConstant.IS_VERIFIED,
        login_provider: LOGIN_PROVIDER.EMAIL,
      },
    ],
    skipDuplicates: true,
  });
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
