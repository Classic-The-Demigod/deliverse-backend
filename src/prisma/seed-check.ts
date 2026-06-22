import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const rawConnectionString = (process.env.DATABASE_URL || 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public').replace('localhost', '127.0.0.1');
  console.log('Using Connection String:', rawConnectionString);
  
  const pool = new Pool({ connectionString: rawConnectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('--- ALL KYC DOCUMENTS ---');
  const allDocs = await prisma.kycDocument.findMany();
  console.log(allDocs);

  console.log('--- ALL ORDERS ---');
  const allOrders = await prisma.order.findMany();
  console.log(allOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, driverId: o.driverId, userId: o.userId })));

  console.log('--- USERS ---');
  const users = await prisma.user.findMany({
    include: {
      driverProfile: { include: { documents: true } },
      businessProfile: { include: { documents: true } },
      operatorProfile: { include: { documents: true } },
    }
  });

  for (const u of users) {
    console.log(`User: ${u.fullName} (${u.email}) - Role: ${u.role}`);
    if (u.driverProfile) {
      console.log(`  Driver Profile: ${u.driverProfile.id}, Status: ${u.driverProfile.onboardingStatus}`);
      console.log(`  Documents:`, u.driverProfile.documents.map(d => ({ type: d.type, status: d.status, fileUrl: d.fileUrl })));
      const driverOrders = await prisma.order.findMany({ where: { driverId: u.driverProfile.id } });
      console.log(`  Orders: ${driverOrders.length}`);
    }
    if (u.businessProfile) {
      console.log(`  Business Profile: ${u.businessProfile.id}, Status: ${u.businessProfile.onboardingStatus}`);
      console.log(`  Documents:`, u.businessProfile.documents.map(d => ({ type: d.type, status: d.status, fileUrl: d.fileUrl })));
      const businessOrders = await prisma.order.findMany({ where: { userId: u.id } });
      console.log(`  Orders: ${businessOrders.length}`);
    }
    if (u.operatorProfile) {
      console.log(`  Operator Profile: ${u.operatorProfile.id}, Status: ${u.operatorProfile.onboardingStatus}`);
      console.log(`  Documents:`, u.operatorProfile.documents.map(d => ({ type: d.type, status: d.status, fileUrl: d.fileUrl })));
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
