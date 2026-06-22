import { PrismaClient, VehicleType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/deliverse';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding Operator and Driver Invitation...');

  // 1. Check if the "PrimeRoute Express" operator from your list exists, or just get the first one
  let operator = await prisma.operatorProfile.findFirst();

  if (!operator) {
    // We need a user to tie to the operator
    const user = await prisma.user.create({
      data: {
        email: 'operator@primeroute.com',
        phone: '1234567890',
        role: 'OPERATOR',
        isVerified: true,
        fullName: 'Admin Route',
      },
    });

    operator = await prisma.operatorProfile.create({
      data: {
        userId: user.id,
        companyName: 'PrimeRoute Express',
        address: '123 Route St, Lagos',
        isApproved: true,
      },
    });
  }

  // 2. Create vehicles for the operator
  const vehicleTypes: VehicleType[] = ['BICYCLE', 'BIKE', 'TRICYCLE', 'CAR', 'VAN', 'TRUCK'];
  const vehicles: any[] = [];

  for (const type of vehicleTypes) {
    const existing = await prisma.vehicle.findFirst({
      where: { operatorId: operator.id, vehicleType: type },
    });

    if (!existing) {
      const v = await prisma.vehicle.create({
        data: {
          operatorId: operator.id,
          vehicleType: type,
          licensePlate: `${type}-${Math.floor(Math.random() * 10000)}`,
        },
      });
      vehicles.push(v);
      console.log(`✅ Created vehicle: ${type} (${v.licensePlate})`);
    } else {
      vehicles.push(existing);
      console.log(`⚡ Vehicle ${type} already exists.`);
    }
  }

  // 3. Create a pending UserInvitation for the test driver and assign the CAR
  const driverEmail = 'driver@example.com';
  const assignedCar = vehicles.find((v) => v.vehicleType === 'CAR');

  let invite = await prisma.userInvitation.findFirst({
    where: { email: driverEmail, role: 'DRIVER' },
  });

  if (!invite) {
    invite = await prisma.userInvitation.create({
      data: {
        email: driverEmail,
        role: 'DRIVER',
        status: 'PENDING',
        inviteToken: `token-${Date.now()}`,
        operatorId: operator.id,
        assignedVehicleId: assignedCar?.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    });
    console.log(`✉️ Created Driver Invitation for ${driverEmail} with vehicle ${assignedCar?.vehicleType}`);
  } else {
    console.log(`✉️ Invitation for ${driverEmail} already exists.`);
  }

  console.log('✅ Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
