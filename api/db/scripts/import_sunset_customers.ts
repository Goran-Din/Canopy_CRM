import pg from 'pg';
import 'dotenv/config';
import { CSV_DATA } from './_csv_data.js';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'canopy_crm',
  user: process.env.DB_USER || 'canopy',
  password: process.env.DB_PASSWORD || 'canopy_dev',
});

interface CsvRow {
  display_name: string;
  first_name: string;
  last_name: string;
  company_name: string;
  customer_type: string;
  status: string;
  email: string;
  phone: string;
  service_address: string;
  billing_address: string;
  city: string;
  zip: string;
  state: string;
  lawn_area_sqft: string;
  service_type: string;
  notes: string;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n');
  if (lines.length === 0) throw new Error('Empty CSV file');

  // Parse header — handle BOM
  const headerLine = lines[0].replace(/^\uFEFF/, '').trim();
  const headers = parseRow(headerLine);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseRow(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || '').trim();
    }
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

// Parse a CSV row handling quoted fields with commas and escaped quotes
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function clean(val: string | undefined): string | null {
  if (!val || val.trim() === '') return null;
  return val.trim();
}

function normalizeType(val: string): 'residential' | 'commercial' {
  const lower = (val || '').toLowerCase().trim();
  if (lower === 'commercial') return 'commercial';
  return 'residential';
}

function normalizeStatus(val: string): 'active' | 'inactive' {
  const lower = (val || '').toLowerCase().trim();
  if (lower === 'inactive') return 'inactive';
  return 'active';
}

function parseLawnArea(val: string): number | null {
  if (!val || val.trim() === '') return null;
  const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}

interface CustomerGroup {
  // First row data (used for customer record)
  display_name: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  customer_type: 'residential' | 'commercial';
  status: 'active' | 'inactive';
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  city: string | null;
  zip: string | null;
  state: string;
  notes: string | null;
  // All rows (used for property records)
  properties: Array<{
    service_address: string | null;
    city: string | null;
    zip: string | null;
    state: string;
    lawn_area_sqft: number | null;
    customer_type: 'residential' | 'commercial';
  }>;
}

async function main() {
  console.log('=== Sunset Services Customer Import ===\n');

  // Parse embedded CSV data
  const rows = parseCsv(CSV_DATA);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Group by display_name
  const groups = new Map<string, CustomerGroup>();
  for (const row of rows) {
    const key = (row.display_name || '').trim();
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        display_name: key,
        first_name: clean(row.first_name) || key.split(' ')[0] || 'Unknown',
        last_name: clean(row.last_name) || key.split(' ').slice(1).join(' ') || 'Unknown',
        company_name: clean(row.company_name) || (normalizeType(row.customer_type) === 'commercial' ? key : null),
        customer_type: normalizeType(row.customer_type),
        status: normalizeStatus(row.status),
        email: clean(row.email),
        phone: clean(row.phone),
        billing_address: clean(row.billing_address) || clean(row.service_address),
        city: clean(row.city),
        zip: clean(row.zip),
        state: clean(row.state) || 'IL',
        notes: clean(row.notes),
        properties: [],
      });
    }

    const group = groups.get(key)!;
    group.properties.push({
      service_address: clean(row.service_address),
      city: clean(row.city),
      zip: clean(row.zip),
      state: clean(row.state) || 'IL',
      lawn_area_sqft: parseLawnArea(row.lawn_area_sqft),
      customer_type: normalizeType(row.customer_type),
    });
  }

  console.log(`Grouped into ${groups.size} unique customers\n`);

  const client = await pool.connect();
  let customersCreated = 0;
  let propertiesCreated = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    // Get tenant_id for Sunset Services
    const tenantResult = await client.query(
      `SELECT id FROM tenants WHERE slug = 'sunset-services'`,
    );
    if (tenantResult.rows.length === 0) {
      throw new Error('Tenant "sunset-services" not found. Run seeds first.');
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`Tenant ID: ${tenantId}`);

    // Get admin user for created_by
    const userResult = await client.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = 'goran@sunsetservices.us'`,
      [tenantId],
    );
    if (userResult.rows.length === 0) {
      throw new Error('Admin user goran@sunsetservices.us not found. Run seeds first.');
    }
    const userId = userResult.rows[0].id;
    console.log(`Admin user ID: ${userId}\n`);

    // Get existing emails for duplicate check
    const existingResult = await client.query(
      `SELECT LOWER(email) AS email FROM customers WHERE tenant_id = $1 AND email IS NOT NULL AND deleted_at IS NULL`,
      [tenantId],
    );
    const existingEmails = new Set(existingResult.rows.map((r: { email: string }) => r.email));
    console.log(`Found ${existingEmails.size} existing customer emails\n`);

    let processed = 0;
    for (const [, group] of groups) {
      processed++;

      // Duplicate check by email
      if (group.email && existingEmails.has(group.email.toLowerCase())) {
        skipped++;
        continue;
      }

      // Insert customer with auto-generated customer_number
      const customerResult = await client.query(
        `WITH next_num AS (
           INSERT INTO customer_number_seq (tenant_id, next_val)
           VALUES ($1, 2)
           ON CONFLICT (tenant_id)
           DO UPDATE SET next_val = customer_number_seq.next_val + 1
           RETURNING next_val - 1 AS num
         )
         INSERT INTO customers (
           tenant_id, customer_number, customer_type, status, source,
           company_name, first_name, last_name, display_name,
           email, phone,
           billing_address_line1, billing_city, billing_state, billing_zip, billing_country,
           notes, created_by, updated_by
         ) VALUES (
           $1, 'SS-' || LPAD((SELECT num FROM next_num)::text, 4, '0'), $2, $3, 'manual',
           $4, $5, $6, $7,
           $8, $9,
           $10, $11, $12, $13, 'US',
           $14, $15, $15
         )
         RETURNING id, customer_number`,
        [
          tenantId,
          group.customer_type,
          group.status,
          group.company_name,
          group.first_name,
          group.last_name,
          group.display_name,
          group.email,
          group.phone,
          group.billing_address,
          group.city,
          group.state,
          group.zip,
          group.notes,
          userId,
        ],
      );

      const customerId = customerResult.rows[0].id;
      customersCreated++;

      // Track email to prevent duplicates within this import
      if (group.email) {
        existingEmails.add(group.email.toLowerCase());
      }

      // Insert properties for this customer
      for (const prop of group.properties) {
        const propType = prop.customer_type === 'commercial' ? 'commercial' : 'residential';

        await client.query(
          `INSERT INTO properties (
             tenant_id, customer_id, property_name,
             property_type, status,
             address_line1, city, state, zip, country,
             lawn_area_sqft,
             created_by, updated_by
           ) VALUES (
             $1, $2, $3,
             $4, 'active',
             $5, $6, $7, $8, 'US',
             $9,
             $10, $10
           )`,
          [
            tenantId,
            customerId,
            prop.service_address || group.display_name,
            propType,
            prop.service_address,
            prop.city,
            prop.state,
            prop.zip,
            prop.lawn_area_sqft,
            userId,
          ],
        );
        propertiesCreated++;
      }

      if (processed % 50 === 0) {
        console.log(`  Processed ${processed}/${groups.size} customers...`);
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Import Complete ===');
    console.log(`  Customers created: ${customersCreated}`);
    console.log(`  Properties created: ${propertiesCreated}`);
    console.log(`  Skipped (duplicates): ${skipped}`);
    console.log(`  Total rows in CSV: ${rows.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nImport FAILED — transaction rolled back.');
    console.error((err as Error).message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
