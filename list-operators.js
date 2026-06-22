const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const operators = await prisma.user.findMany({
    where: { role: 'OPERATOR' },
    include: { operatorProfile: true }
  });
  console.log('--- OPERATORS ---');
  console.dir(operators, { depth: null });

  const allUsers = await prisma.user.findMany();
  console.log('\n--- ALL USERS ---');
  console.dir(allUsers.map(u => ({ id: u.id, email: u.email, role: u.role })), { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
