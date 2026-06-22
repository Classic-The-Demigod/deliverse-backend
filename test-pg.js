const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public' });
  await client.connect();
  
  const res = await client.query(`
    SELECT o.id, o."userId", d."userId" as driver_user_id, op."userId" as operator_user_id 
    FROM orders o 
    LEFT JOIN driver_profiles d ON o."driverId" = d.id 
    LEFT JOIN operator_profiles op ON o."operatorId" = op.id 
    WHERE o.id = 'cmpy22n580001ecvhdoz7pgp7'
  `);
  
  console.log(res.rows[0]);
  await client.end();
}

check().catch(console.error);
