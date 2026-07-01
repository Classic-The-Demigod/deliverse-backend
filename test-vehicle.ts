import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const operator = await prisma.operatorProfile.findFirst();
  if (!operator) {
    console.log('No operator found');
    return;
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        operatorId: operator.id,
        licensePlate: 'TEST-1234',
        vehicleType: 'BIKE',
      }
    });
    console.log('Vehicle created:', vehicle);
  } catch (e) {
    console.error('Error creating vehicle:', e);
  }
}

main().finally(() => prisma.$disconnect());
