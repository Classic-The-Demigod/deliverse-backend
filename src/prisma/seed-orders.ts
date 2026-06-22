import { PrismaClient, VehicleType, OrderStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const rawConnectionString = (process.env.DATABASE_URL || 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public').replace('localhost', '127.0.0.1');
  console.log('Seeding mock orders via:', rawConnectionString);
  
  const pool = new Pool({ connectionString: rawConnectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // 1. Get Baby Driver (Driver)
  const babyDriverUser = await prisma.user.findUnique({
    where: { email: 'babydriver@gmail.com' },
    include: { driverProfile: true }
  });

  // 2. Get SwiftMove Logistics (Operator)
  const swiftMoveUser = await prisma.user.findUnique({
    where: { email: 'hello@swiftmove.com' },
    include: { operatorProfile: true }
  });

  // 3. Get normal customer (johndoe@gmail.com or abdullahimuftau2003@gmail.com)
  const customerUser = await prisma.user.findFirst({
    where: { role: 'USER' }
  });

  if (!customerUser) {
    console.log('No USER customer found in DB!');
    return;
  }

  // Clear old orders
  await prisma.order.deleteMany({});
  console.log('Cleared existing orders.');

  // Create 3 orders assigned to Baby Driver
  if (babyDriverUser && babyDriverUser.driverProfile && swiftMoveUser && swiftMoveUser.operatorProfile) {
    console.log('Creating orders assigned to Baby Driver...');
    await prisma.order.createMany({
      data: [
        {
          orderNumber: 'DLV-2026-001',
          status: 'DELIVERED',
          driverId: babyDriverUser.driverProfile.id,
          operatorId: swiftMoveUser.operatorProfile.id,
          userId: customerUser.id,
          vehicleType: 'CAR',
          quotedPrice: 15000,
          finalPrice: 15000,
          pickupAddress: 'Lekki Phase 1, Lagos',
          pickupLatitude: 6.4281,
          pickupLongitude: 3.4219,
          pickupContactName: 'John Customer',
          pickupContactPhone: '08012345678',
          dropoffAddress: 'Ikeja City Mall, Lagos',
          dropoffLatitude: 6.6018,
          dropoffLongitude: 3.3515,
          recipientName: 'Sarah Receiver',
          recipientPhone: '08087654321',
          packageName: 'Electronics Package',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          orderNumber: 'DLV-2026-002',
          status: 'DELIVERED',
          driverId: babyDriverUser.driverProfile.id,
          operatorId: swiftMoveUser.operatorProfile.id,
          userId: customerUser.id,
          vehicleType: 'CAR',
          quotedPrice: 22000,
          finalPrice: 22000,
          pickupAddress: 'Yaba, Lagos',
          pickupLatitude: 6.5095,
          pickupLongitude: 3.3711,
          pickupContactName: 'Alice Sender',
          pickupContactPhone: '08022334455',
          dropoffAddress: 'Victoria Island, Lagos',
          dropoffLatitude: 6.4281,
          dropoffLongitude: 3.4219,
          recipientName: 'Bob Receiver',
          recipientPhone: '08099887766',
          packageName: 'Important Documents',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
          orderNumber: 'DLV-2026-003',
          status: 'ASSIGNED',
          driverId: babyDriverUser.driverProfile.id,
          operatorId: swiftMoveUser.operatorProfile.id,
          userId: customerUser.id,
          vehicleType: 'CAR',
          quotedPrice: 8500,
          pickupAddress: 'Surulere, Lagos',
          pickupLatitude: 6.4979,
          pickupLongitude: 3.3582,
          pickupContactName: 'David Sender',
          pickupContactPhone: '08055443322',
          dropoffAddress: 'Apapa, Lagos',
          dropoffLatitude: 6.4442,
          dropoffLongitude: 3.3667,
          recipientName: 'Frank Receiver',
          recipientPhone: '08011223344',
          packageName: 'Fashion Accessories',
          createdAt: new Date()
        }
      ]
    });
    console.log('Baby Driver orders created!');
  }

  // Create 3 orders placed by SwiftMove Logistics (as a business/user)
  if (swiftMoveUser) {
    console.log('Creating orders placed by SwiftMove Logistics...');
    await prisma.order.createMany({
      data: [
        {
          orderNumber: 'DLV-2026-004',
          status: 'DELIVERED',
          userId: swiftMoveUser.id,
          vehicleType: 'VAN',
          quotedPrice: 35000,
          finalPrice: 35000,
          pickupAddress: 'Gbagada, Lagos',
          pickupLatitude: 6.5583,
          pickupLongitude: 3.3833,
          pickupContactName: 'Swift Warehouse',
          pickupContactPhone: '08077665544',
          dropoffAddress: 'Ikorodu, Lagos',
          dropoffLatitude: 6.6194,
          dropoffLongitude: 3.5106,
          recipientName: 'Retail Shop A',
          recipientPhone: '08033221100',
          packageName: 'Bulk Beverages',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        },
        {
          orderNumber: 'DLV-2026-005',
          status: 'CREATED',
          userId: swiftMoveUser.id,
          vehicleType: 'TRUCK',
          quotedPrice: 75000,
          pickupAddress: 'Apapa Port, Lagos',
          pickupLatitude: 6.4442,
          pickupLongitude: 3.3667,
          pickupContactName: 'Port Logistics',
          pickupContactPhone: '08011122233',
          dropoffAddress: 'Ikeja Industrial Area, Lagos',
          dropoffLatitude: 6.6018,
          dropoffLongitude: 3.3515,
          recipientName: 'Factory Manager',
          recipientPhone: '08044455566',
          packageName: 'Industrial Raw Materials',
          createdAt: new Date()
        }
      ]
    });
    console.log('SwiftMove Logistics placed orders created!');
  }

  console.log('✅ Seeding mock orders finished.');

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
