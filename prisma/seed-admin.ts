import { PrismaClient, Role, AuthProvider, SignupChannel } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'useadmin@deliverse.com';
  const phone = '+234 80 000 0001';
  const password = 'Admin@2026';

  console.log(`Checking if admin exists with email: ${email}`);

  let adminUser = await prisma.user.findUnique({
    where: { email },
  });

  if (adminUser) {
    console.log('Admin user already exists!');
    return;
  }

  const passwordHash = await argon2.hash(password);

  console.log('Creating Admin user...');

  adminUser = await prisma.user.create({
    data: {
      email,
      phone,
      passwordHash,
      role: Role.ADMIN,
      primaryAuthProvider: AuthProvider.LOCAL,
      signupChannel: SignupChannel.WEB_DASHBOARD,
      isVerified: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      fullName: 'Super Admin',
      authIdentities: {
        create: {
          provider: AuthProvider.LOCAL,
          providerAccountId: email,
          email,
        },
      },
      adminProfile: {
        create: {
          fullName: 'Super Admin',
          level: 'SUPER',
        },
      },
    },
  });

  console.log(`Admin created successfully!`);
  console.log(`Email: ${adminUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
