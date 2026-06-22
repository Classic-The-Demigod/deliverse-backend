import { PrismaClient, OnboardingStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const rawConnectionString = (process.env.DATABASE_URL || 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public').replace('localhost', '127.0.0.1');
  console.log('Seeding mock documents via:', rawConnectionString);
  
  const pool = new Pool({ connectionString: rawConnectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // 1. Get Baby Driver (New Driver)
  const babyDriverUser = await prisma.user.findUnique({
    where: { email: 'babydriver@gmail.com' },
    include: { driverProfile: true }
  });

  if (babyDriverUser && babyDriverUser.driverProfile) {
    console.log('Seeding documents for Baby Driver...');
    
    // Clear old docs
    await prisma.kycDocument.deleteMany({
      where: { driverId: babyDriverUser.driverProfile.id }
    });

    // Create NIN and Driver License
    await prisma.kycDocument.createMany({
      data: [
        {
          driverId: babyDriverUser.driverProfile.id,
          type: 'NIN',
          fileUrl: 'https://res.cloudinary.com/delzmzap2/image/upload/v1780921284/deliverse/vu3zmtdzyptk33gaolpx.pdf',
          status: 'PENDING'
        },
        {
          driverId: babyDriverUser.driverProfile.id,
          type: 'DRIVER_LICENSE',
          fileUrl: 'https://res.cloudinary.com/delzmzap2/image/upload/v1781105266011/deliverse/mock_license.png',
          status: 'PENDING'
        }
      ]
    });

    // Update status to PENDING_REVIEW
    await prisma.driverProfile.update({
      where: { id: babyDriverUser.driverProfile.id },
      data: {
        onboardingStatus: OnboardingStatus.PENDING_REVIEW,
        onboardingSubmittedAt: new Date()
      }
    });

    console.log('Baby Driver documents seeded successfully!');
  } else {
    console.log('Baby Driver user or profile not found!');
  }

  // 2. Get SwiftMove Logistics
  const swiftMoveUser = await prisma.user.findUnique({
    where: { email: 'hello@swiftmove.com' },
    include: { operatorProfile: true }
  });

  if (swiftMoveUser && swiftMoveUser.operatorProfile) {
    console.log('Seeding documents for SwiftMove Logistics...');

    // Clear old docs
    await prisma.kycDocument.deleteMany({
      where: { operatorId: swiftMoveUser.operatorProfile.id }
    });

    // Create Business Registration
    await prisma.kycDocument.create({
      data: {
        operatorId: swiftMoveUser.operatorProfile.id,
        type: 'BUSINESS_REGISTRATION',
        fileUrl: 'https://res.cloudinary.com/delzmzap2/image/upload/v1780921284/deliverse/vu3zmtdzyptk33gaolpx.pdf',
        status: 'PENDING'
      }
    });

    // Update status to PENDING_REVIEW
    await prisma.operatorProfile.update({
      where: { id: swiftMoveUser.operatorProfile.id },
      data: {
        onboardingStatus: OnboardingStatus.PENDING_REVIEW,
        onboardingSubmittedAt: new Date()
      }
    });

    console.log('SwiftMove Logistics documents seeded successfully!');
  } else {
    console.log('SwiftMove Logistics user or profile not found!');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
