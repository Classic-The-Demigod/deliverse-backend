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

  console.log('=== USERS IN DATABASE ===');
  const users = await prisma.user.findMany({
    include: {
      driverProfile: true,
      businessProfile: true,
      operatorProfile: true,
    }
  });
  
  for (const u of users) {
    console.log(`User ID: ${u.id} | Email: ${u.email} | Name: ${u.fullName} | Role: ${u.role}`);
    if (u.driverProfile) {
      console.log(`  Driver ID: ${u.driverProfile.id} | Status: ${u.driverProfile.onboardingStatus} | Operator ID: ${u.driverProfile.operatorId}`);
    }
    if (u.businessProfile) {
      console.log(`  Business ID: ${u.businessProfile.id} | Name: ${u.businessProfile.businessName} | Status: ${u.businessProfile.onboardingStatus}`);
    }
    if (u.operatorProfile) {
      console.log(`  Operator ID: ${u.operatorProfile.id} | Company: ${u.operatorProfile.companyName} | Status: ${u.operatorProfile.onboardingStatus}`);
    }
  }

  console.log('\n=== ORDERS IN DATABASE ===');
  const orders = await prisma.order.findMany({
    include: {
      user: true,
      driver: { include: { user: true } },
      operator: { include: { user: true } }
    }
  });

  for (const o of orders) {
    console.log(`Order ID: ${o.id} | Number: ${o.orderNumber} | Status: ${o.status}`);
    console.log(`  User: ${o.user.email} (ID: ${o.userId})`);
    if (o.driver) {
      console.log(`  Driver: ${o.driver.user.email} (ID: ${o.driverId})`);
    } else {
      console.log(`  Driver: None`);
    }
    if (o.operator) {
      console.log(`  Operator: ${o.operator.user.email} (ID: ${o.operatorId})`);
    } else {
      console.log(`  Operator: None`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
