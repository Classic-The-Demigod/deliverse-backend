const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const operator = await prisma.user.findUnique({
    where: { email: 'smartlogistics@gmail.com' },
    include: { operatorProfile: true }
  });
  
  if (!operator || !operator.operatorProfile) {
    console.log('Operator smartlogistics@gmail.com not found');
    return;
  }

  const opId = operator.operatorProfile.id;
  console.log(`Operator User Email: ${operator.email}, Profile ID: ${opId}`);

  const drivers = await prisma.driverProfile.findMany({
    where: { operatorId: opId },
    include: { vehicle: true, user: true }
  });
  console.log('\n--- DRIVER PROFILES ---');
  console.dir(drivers, { depth: null });

  const invitations = await prisma.userInvitation.findMany({
    where: { operatorId: opId },
    include: { assignedVehicle: true }
  });
  console.log('\n--- INVITED DRIVERS (PENDING INVITATIONS) ---');
  console.dir(invitations, { depth: null });

  const vehicles = await prisma.vehicle.findMany({
    where: { operatorId: opId }
  });
  console.log('\n--- OPERATOR VEHICLES ---');
  console.dir(vehicles, { depth: null });

  const orders = await prisma.order.findMany({
    where: { operatorId: opId }
  });
  console.log('\n--- ORDERS FOR THIS OPERATOR ---');
  console.dir(orders, { depth: null });

  const allOrders = await prisma.order.count();
  console.log(`\nTotal orders in DB: ${allOrders}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
