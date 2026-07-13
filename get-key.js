const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const key = await prisma.apiKey.findFirst();
  console.log('KEY_FOUND:', key?.key);
}
main().finally(() => prisma.$disconnect());
