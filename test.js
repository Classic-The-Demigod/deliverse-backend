require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNumber: true, status: true, operatorId: true, vehicleType: true }
  });
  const driver = await prisma.driverProfile.findFirst({
    include: { vehicle: true }
  });
  console.log('ORDER:', order);
  console.log('DRIVER:', driver);
}

main().catch(console.error).finally(() => prisma.$disconnect());
