import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'canopy_crm',
  user: process.env.DB_USER || 'canopy',
  password: process.env.DB_PASSWORD || 'canopy_dev',
});

const SEEDS_DIR = path.join(__dirname, 'seeds');

async function seed() {
  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('  No seed files found.');
    return;
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${file}:`, (err as Error).message);
      throw err;
    } finally {
      client.release();
    }
  }
}

async function main() {
  console.log('Running database seeds...');

  try {
    await seed();
    console.log('Seeding complete.');
  } catch {
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
