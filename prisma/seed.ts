import { PrismaClient } from '@prisma/client';
import { initialSeed } from './seeds/initial.seed';

const prisma = new PrismaClient({ log: ['query'] });

async function main() {
  await initialSeed(prisma);
}

main()
  .catch((e) => {
    console.error(e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
