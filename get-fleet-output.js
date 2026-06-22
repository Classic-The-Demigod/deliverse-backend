const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = 'cmq56g8we0007f4vhix45msqp';
  
  const operator = await prisma.operatorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!operator) {
    console.log('Operator not found');
    return;
  }

  const driversRaw = await prisma.driverProfile.findMany({
    where: { operatorId: operator.id },
    include: {
      vehicle: true,
      user: true,
      documents: true,
      ratings: {
        select: { score: true }
      },
      orders: {
        where: { status: 'DELIVERED' },
        select: { finalPrice: true }
      }
    },
  });

  const drivers = driversRaw.map(d => {
    const avgRating = d.ratings.length > 0 
      ? d.ratings.reduce((sum, r) => sum + r.score, 0) / d.ratings.length 
      : 0;

    return {
      id: d.id,
      name: `${d.firstName} ${d.lastName}`.trim() || 'New Driver',
      status: d.user?.isVerified ? d.status : 'PENDING',
      vehicle: d.vehicle ? `${d.vehicle.vehicleType} #${d.vehicle.licensePlate.substring(0,4)}` : 'Unassigned',
      deliveries: d.totalDeliveries,
      revenue: d.orders.reduce((sum, o) => sum + (o.finalPrice?.toNumber() || 0), 0),
      rating: avgRating > 0 ? avgRating.toFixed(1) : 'New',
      firstName: d.firstName,
      lastName: d.lastName,
      vehicleId: d.vehicleId,
      vehicleType: d.vehicle?.vehicleType || null,
      phone: d.user?.phone,
      dateOfBirth: d.user?.dateOfBirth,
      address: d.address,
      licenseNumber: d.licenseNumber,
      documents: d.documents,
    };
  });

  const pendingInvites = await prisma.userInvitation.findMany({
    where: { operatorId: operator.id, status: 'PENDING', role: 'DRIVER' },
    include: { assignedVehicle: true }
  });

  const inviteDrivers = pendingInvites.map(i => ({
    id: i.id,
    name: i.email || i.phone || 'Invited Driver',
    status: 'PENDING',
    vehicle: i.assignedVehicle ? `${i.assignedVehicle.vehicleType} #${i.assignedVehicle.licensePlate.substring(0,4)}` : 'Unassigned',
    deliveries: 0,
    revenue: 0,
    rating: 0,
    firstName: '',
    lastName: '',
    vehicleId: i.assignedVehicleId,
    vehicleType: i.assignedVehicle?.vehicleType || null,
  }));

  console.log('API RESPONSE DRIVERS:');
  console.dir([...drivers, ...inviteDrivers], { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
