const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/deliverse?schema=public'
    }
  }
});

async function main() {
  const orders = await prisma.order.findMany();
  console.log(orders.length, 'total orders');
  
  const history = orders.filter(o => ['DELIVERED', 'DELIVERY_SUCCESS', 'CANCELLED', 'FAILED'].includes(o.status));
  console.log(history.length, 'history orders');
  
  const active = orders.filter(o => !['DELIVERED', 'DELIVERY_SUCCESS', 'CANCELLED', 'FAILED'].includes(o.status));
  console.log(active.length, 'active orders');

  console.log('Sample of statuses:', orders.slice(0, 5).map(o => o.status));
}

main().catch(console.error).finally(() => prisma.$disconnect());
