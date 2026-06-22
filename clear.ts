import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const deleted = await prisma.order.deleteMany({});
    console.log(`Successfully cleared ${deleted.count} orders from the database.`);
  } catch (error) {
    console.error('Error clearing orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
