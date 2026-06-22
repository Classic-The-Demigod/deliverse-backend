const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public'
  });
  await client.connect();

  const res = await client.query('SELECT u.email, o.status, COUNT(o.id) FROM "users" u JOIN "orders" o ON u.id = o."userId" GROUP BY u.email, o.status');
  console.log('Orders by status:', res.rows);

  await client.end();
}

main().catch(console.error);
