const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: 'cmpy22n580001ecvhdoz7pgp7' },
    include: { driver: true, operator: true }
  });
  console.log(JSON.stringify(order, null, 2));
}

main().finally(() => prisma.$disconnect());
