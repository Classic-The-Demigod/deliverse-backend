import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const baseConnectionString = 'postgresql://postgres:unruly2003@127.0.0.1:5432/postgres';
  console.log('Connecting to Postgres via:', baseConnectionString);
  
  const client = new Client({ connectionString: baseConnectionString });
  await client.connect();

  // List all databases
  const dbRes = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
  const dbs = dbRes.rows.map(r => r.datname);
  console.log('Available Databases:', dbs);

  for (const db of dbs) {
    console.log(`\n--- Inspecting Database: ${db} ---`);
    const dbClient = new Client({ connectionString: `postgresql://postgres:unruly2003@127.0.0.1:5432/${db}` });
    try {
      await dbClient.connect();
      
      // Check if orders table exists
      const tableCheck = await dbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'orders'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        const orderCount = await dbClient.query('SELECT COUNT(*) FROM orders;');
        const userCount = await dbClient.query('SELECT COUNT(*) FROM users;');
        const docCount = await dbClient.query('SELECT COUNT(*) FROM kyc_documents;');
        console.log(`  orders table exists!`);
        console.log(`  Total Orders: ${orderCount.rows[0].count}`);
        console.log(`  Total Users: ${userCount.rows[0].count}`);
        console.log(`  Total KYC Documents: ${docCount.rows[0].count}`);
      } else {
        console.log(`  orders table does not exist.`);
      }
    } catch (err: any) {
      console.log(`  Failed to connect/inspect: ${err.message}`);
    } finally {
      await dbClient.end();
    }
  }

  await client.end();
}

main().catch(console.error);
