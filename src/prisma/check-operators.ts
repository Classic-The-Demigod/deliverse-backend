import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const rawConnectionString = (process.env.DATABASE_URL || 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public').replace('localhost', '127.0.0.1');
  
  const pool = new Pool({ connectionString: rawConnectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('=== OPERATORS DETAILS ===');
  const operators = await prisma.operatorProfile.findMany({
    include: {
      vehicles: { include: { drivers: true } },
      pricingConfigs: true,
      drivers: true
    }
  });

  for (const op of operators) {
    console.log(`Operator ID: ${op.id} | Company: ${op.companyName} | Status: ${op.onboardingStatus}`);
    console.log(`  Pricing Configs count: ${op.pricingConfigs.length}`);
    for (const pc of op.pricingConfigs) {
      console.log(`    VehicleType: ${pc.vehicleType} | Urgency: ${pc.urgencyTier} | BaseFare: ${pc.baseFare} | PerKm: ${pc.perKmRate} | Active: ${pc.isActive}`);
    }
    console.log(`  Vehicles count: ${op.vehicles.length}`);
    for (const v of op.vehicles) {
      console.log(`    Vehicle ID: ${v.id} | Plate: ${v.licensePlate} | Type: ${v.vehicleType} | Active: ${v.isActive} | Drivers count: ${v.drivers.length}`);
    }
    console.log(`  Drivers count: ${op.drivers.length}`);
    for (const d of op.drivers) {
      console.log(`    Driver ID: ${d.id} | Name: ${d.firstName} ${d.lastName} | Status: ${d.status} | VehicleId: ${d.vehicleId}`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
