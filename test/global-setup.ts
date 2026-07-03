import { execSync } from 'child_process';

export default async () => {
  process.env.DATABASE_URL = 'postgresql://postgres:unruly2003@localhost:5432/deliverse_test';
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  
  console.log('\n[E2E] Pushing schema and resetting test database (deliverse_test)...');
  try {
    execSync('npx prisma db push --force-reset', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Failed to setup test database. Ensure local PostgreSQL is running and credentials are correct.', err);
    throw err;
  }
};
