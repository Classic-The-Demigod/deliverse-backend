const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'DRIVER' } });
  console.log(users.map(u => ({ email: u.email, isVerified: u.isVerified, isActive: u.isActive })));
  
  const user = await prisma.user.findUnique({ where: { email: 'drive@example.com' } });
  console.log('drive@example.com:', user);
  
  const invites = await prisma.userInvitation.findMany({ where: { email: 'drive@example.com' } });
  console.log('invites:', invites);
}

main().finally(() => prisma.$disconnect());
