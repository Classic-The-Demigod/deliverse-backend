import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = (process.env.DATABASE_URL || 'postgresql://postgres:unruly2003@localhost:5432/deliverse?schema=public').replace('localhost', '127.0.0.1');
  console.log('Connecting to deliverse database via:', connectionString);
  
  const client = new Client({ connectionString });
  await client.connect();

  // List all schemas
  const schemaRes = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema') AND schema_name NOT LIKE 'pg_toast%';
  `);
  const schemas = schemaRes.rows.map(r => r.schema_name);
  console.log('Available Schemas:', schemas);

  for (const schema of schemas) {
    console.log(`\n--- Inspecting Schema: ${schema} ---`);
    // List tables in this schema
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1;
    `, [schema]);
    const tables = tableRes.rows.map(r => r.table_name);
    console.log(`Tables in ${schema}:`, tables);

    if (tables.includes('orders')) {
      const orderCount = await client.query(`SELECT COUNT(*) FROM "${schema}".orders;`);
      console.log(`  orders table count in ${schema}: ${orderCount.rows[0].count}`);
    }
  }

  await client.end();
}

main().catch(console.error);
