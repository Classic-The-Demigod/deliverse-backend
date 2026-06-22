import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function countOrders() {
  const count = await prisma.order.count();
  const latest = await prisma.order.findFirst({ orderBy: { createdAt: 'desc' }, include: { payment: true } });
  console.log('Total Orders:', count);
  console.log('Latest Order:', JSON.stringify(latest, null, 2));
}
countOrders().catch(console.error).finally(() => prisma.$disconnect());
