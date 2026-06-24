import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const operators = await prisma.operatorProfile.findMany({
    include: {
      vehicles: {
        include: {
          drivers: true
        }
      },
      pricingConfigs: true,
      user: true,
    }
  });

  console.log(JSON.stringify(operators, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
