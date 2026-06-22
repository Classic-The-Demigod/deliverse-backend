const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public' });
  await client.connect();
  
  const res = await client.query(`
    SELECT email, role, "isVerified" FROM users WHERE role = 'DRIVER' OR email LIKE '%drive%'
  `);
  
  console.log(res.rows);
  await client.end();
}

check().catch(console.error);
