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

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY id ASC',
  );
  return result.rows.map((r) => r.name);
}

function getMigrationFiles(direction: 'up' | 'down'): string[] {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(`.${direction}.sql`))
    .sort();
  return files;
}

async function migrateUp() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();
  const files = getMigrationFiles('up');
  let count = 0;

  for (const file of files) {
    const name = file.replace('.up.sql', '');
    if (executed.includes(name)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`  ✓ ${name}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${name}:`, (err as Error).message);
      throw err;
    } finally {
      client.release();
    }
  }

  if (count === 0) {
    console.log('  No new migrations to run.');
  } else {
    console.log(`  ${count} migration(s) applied.`);
  }
}

async function migrateDown() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  if (executed.length === 0) {
    console.log('  No migrations to rollback.');
    return;
  }

  const lastMigration = executed[executed.length - 1];
  const downFile = `${lastMigration}.down.sql`;
  const downPath = path.join(MIGRATIONS_DIR, downFile);

  if (!fs.existsSync(downPath)) {
    console.error(`  Down migration not found: ${downFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(downPath, 'utf-8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM _migrations WHERE name = $1', [lastMigration]);
    await client.query('COMMIT');
    console.log(`  ✓ Rolled back: ${lastMigration}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ✗ Rollback failed for ${lastMigration}:`, (err as Error).message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const direction = process.argv[2];

  if (direction !== 'up' && direction !== 'down') {
    console.error('Usage: migrate.ts <up|down>');
    process.exit(1);
  }

  console.log(`Running migrations (${direction})...`);

  try {
    if (direction === 'up') {
      await migrateUp();
    } else {
      await migrateDown();
    }
  } catch {
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
