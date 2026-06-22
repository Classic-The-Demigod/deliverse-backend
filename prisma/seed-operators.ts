import { PrismaClient, Role, AuthProvider, SignupChannel, VehicleType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

function getAdapter() {
  const connectionString = process.env.DATABASE_URL!;
  try {
    const url = new URL(connectionString);
    const schema = url.searchParams.get('schema');
    if (schema) url.searchParams.delete('schema');
    return schema 
      ? new PrismaPg({ connectionString: url.toString() }, { schema }) 
      : new PrismaPg({ connectionString: url.toString() });
  } catch {
    return new PrismaPg({ connectionString });
  }
}

const prisma = new PrismaClient({ adapter: getAdapter() });

async function main() {
  console.log('Seeding Mock Delivery Companies...');

  const companies = [
    {
      name: 'SwiftMove Logistics',
      email: 'hello@swiftmove.com',
      vehicles: [VehicleType.BIKE, VehicleType.CAR],
      trustScore: 98,
    },
    {
      name: 'PrimeRoute Express',
      email: 'contact@primeroute.com',
      vehicles: [VehicleType.CAR, VehicleType.VAN],
      trustScore: 98,
    },
    {
      name: 'UrbanDash Couriers',
      email: 'support@urbandash.com',
      vehicles: [VehicleType.BIKE],
      trustScore: 98,
    },
    {
      name: 'MetroLink Delivery Co.',
      email: 'info@metrolink.com',
      vehicles: [VehicleType.VAN, VehicleType.TRUCK],
      trustScore: 98,
    },
  ];

  for (const company of companies) {
    // Check if exists
    const exists = await prisma.user.findUnique({ where: { email: company.email } });
    if (exists) {
      console.log(`Skipping ${company.name}, already exists.`);
      continue;
    }

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        email: company.email,
        phone: `+234${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        role: Role.OPERATOR,
        primaryAuthProvider: AuthProvider.LOCAL,
        signupChannel: SignupChannel.WEB_DASHBOARD,
        isVerified: true,
        isActive: true,
        fullName: company.name,
      },
    });

    // 2. Create Operator Profile
    const operator = await prisma.operatorProfile.create({
      data: {
        userId: user.id,
        companyName: company.name,
        rcNumber: `RC${Math.floor(100000 + Math.random() * 900000)}`,
        address: '123 Delivery Way, Lagos',
        isApproved: true,
        trustScore: company.trustScore,
        supportPhone: user.phone,
      },
    });

    // 3. Create Vehicles
    for (const vType of company.vehicles) {
      await prisma.vehicle.create({
        data: {
          operatorId: operator.id,
          licensePlate: `LND-${Math.floor(100 + Math.random() * 900)}-${['AB','XY','CD'][Math.floor(Math.random()*3)]}`,
          vehicleType: vType,
          isActive: true,
        },
      });
    }

    // 4. Create Wallet
    await prisma.wallet.create({
      data: {
        userId: user.id,
        operatorId: operator.id,
        balance: 0,
      },
    });

    console.log(`Seeded: ${company.name}`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
