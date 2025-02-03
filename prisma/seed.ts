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
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
