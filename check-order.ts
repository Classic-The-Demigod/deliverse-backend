import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'DLV-MQTQSCOE-22XH' },
    select: { orderNumber: true, packageImageUrl: true }
  });
  console.log(order);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
