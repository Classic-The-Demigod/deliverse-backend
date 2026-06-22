const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: { status: 'DELIVERED' },
    include: { payment: true },
    take: 10
  });

  console.log('=== DELIVERED ORDERS ===', orders.length);
  for (const o of orders) {
    console.log(JSON.stringify({
      id: o.id,
      orderNumber: o.orderNumber,
      finalPrice: o.finalPrice ? o.finalPrice.toString() : null,
      quotedPrice: o.quotedPrice ? o.quotedPrice.toString() : null,
      createdAt: o.createdAt,
      operatorId: o.operatorId,
      paymentStatus: o.payment ? o.payment.status : 'NO_PAYMENT',
      paymentAmount: o.payment ? o.payment.amount.toString() : null,
      operatorAmount: o.payment ? o.payment.operatorAmount.toString() : null
    }));
  }

  const wallets = await prisma.wallet.findMany({
    include: { transactions: { take: 5, orderBy: { createdAt: 'desc' } } }
  });

  console.log('\n=== WALLETS ===', wallets.length);
  for (const w of wallets) {
    console.log(JSON.stringify({
      id: w.id,
      userId: w.userId,
      operatorId: w.operatorId,
      balance: w.balance.toString(),
      escrowBalance: w.escrowBalance.toString(),
      latestTxs: w.transactions.map(t => ({ type: t.type, amount: t.amount.toString(), desc: t.description }))
    }));
  }

  // Check all orders (any status) for the operator
  const allOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, status: true, finalPrice: true, quotedPrice: true, createdAt: true, operatorId: true }
  });
  console.log('\n=== ALL ORDERS ===', allOrders.length);
  for (const o of allOrders) {
    console.log(JSON.stringify({ id: o.id, num: o.orderNumber, status: o.status, finalPrice: o.finalPrice?.toString(), quotedPrice: o.quotedPrice?.toString(), createdAt: o.createdAt, opId: o.operatorId }));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
