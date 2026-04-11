import { logger } from '../../../config/logger.js';
import { queryDb, getClient } from '../../../config/database.js';

export interface ConvertQuotePayload {
  source_quote_number: string;
  source_system: 'canopy_quotes';
  customer: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
  };
  property: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip: string;
    latitude?: number;
    longitude?: number;
    property_category?: string;
  };
  job: {
    job_type: string;
    division?: string;
    description?: string;
    estimated_value?: number;
    notes?: string;
  };
  idempotency_key?: string;
}

export interface ConvertResult {
  crm_job_id: string;
  job_number: string;
  customer_id: string;
  property_id: string;
  is_new_customer: boolean;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-10);
}

export async function convertQuoteToJob(
  tenantId: string,
  payload: ConvertQuotePayload,
): Promise<ConvertResult> {
  // 1. Idempotency check
  if (payload.idempotency_key) {
    const existing = await queryDb<Record<string, unknown>>(
      `SELECT entity_id, external_id FROM integration_sync_log
       WHERE tenant_id = $1 AND provider = 'canopy_quotes'
         AND entity_type = 'quote.convert'
         AND external_id = $2
         AND status = 'success'
       LIMIT 1`,
      [tenantId, payload.idempotency_key],
    );
    if (existing.rows[0]) {
      // Return existing result
      const jobResult = await queryDb<Record<string, unknown>>(
        `SELECT id, job_number, customer_id, property_id
         FROM jobs WHERE id = $1 AND tenant_id = $2`,
        [existing.rows[0].entity_id, tenantId],
      );
      const job = jobResult.rows[0];
      if (job) {
        return {
          crm_job_id: job.id as string,
          job_number: job.job_number as string,
          customer_id: job.customer_id as string,
          property_id: job.property_id as string,
          is_new_customer: false,
        };
      }
    }
  }

  let customerId: string | null = null;
  let isNewCustomer = false;

  // 2. Customer de-duplication (4-step)

  // Step A — Email match
  if (payload.customer.email) {
    const emailResult = await queryDb<Record<string, unknown>>(
      `SELECT c.id FROM customers c
       JOIN contacts ct ON ct.customer_id = c.id
       WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
         AND LOWER(ct.email) = LOWER($2)
       LIMIT 1`,
      [tenantId, payload.customer.email],
    );
    if (emailResult.rows[0]) {
      customerId = emailResult.rows[0].id as string;
    }
  }

  // Step B — Phone match
  if (!customerId && payload.customer.phone) {
    const normalized = normalizePhone(payload.customer.phone);
    if (normalized.length === 10) {
      const phoneResult = await queryDb<Record<string, unknown>>(
        `SELECT c.id FROM customers c
         JOIN contacts ct ON ct.customer_id = c.id
         WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
           AND RIGHT(REGEXP_REPLACE(ct.phone, '[^0-9]', '', 'g'), 10) = $2
         LIMIT 1`,
        [tenantId, normalized],
      );
      if (phoneResult.rows[0]) {
        customerId = phoneResult.rows[0].id as string;
      }
    }
  }

  // Step C — Name + Address match
  if (!customerId) {
    const nameAddrResult = await queryDb<Record<string, unknown>>(
      `SELECT c.id FROM customers c
       JOIN properties p ON p.customer_id = c.id AND p.deleted_at IS NULL
       WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
         AND LOWER(c.first_name) = LOWER($2)
         AND LOWER(c.last_name) = LOWER($3)
         AND LOWER(p.address_line1) = LOWER($4)
         AND LOWER(p.city) = LOWER($5)
       LIMIT 1`,
      [tenantId, payload.customer.first_name, payload.customer.last_name,
       payload.property.address_line1, payload.property.city],
    );
    if (nameAddrResult.rows[0]) {
      customerId = nameAddrResult.rows[0].id as string;
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Step D — Create new customer
    if (!customerId) {
      isNewCustomer = true;
      const displayName = payload.customer.company_name
        ?? `${payload.customer.first_name} ${payload.customer.last_name}`;

      const custResult = await client.query<Record<string, unknown>>(
        `WITH next_num AS (
           INSERT INTO customer_number_seq (tenant_id, next_val)
           VALUES ($1, 2)
           ON CONFLICT (tenant_id)
           DO UPDATE SET next_val = customer_number_seq.next_val + 1
           RETURNING next_val - 1 AS num
         )
         INSERT INTO customers (
           tenant_id, customer_number, customer_type, status, source,
           first_name, last_name, display_name, company_name,
           email, phone
         ) VALUES (
           $1, 'SS-' || LPAD((SELECT num FROM next_num)::text, 4, '0'),
           'residential', 'active', 'canopy_quotes',
           $2, $3, $4, $5, $6, $7
         ) RETURNING id`,
        [
          tenantId,
          payload.customer.first_name, payload.customer.last_name,
          displayName, payload.customer.company_name ?? null,
          payload.customer.email ?? null, payload.customer.phone ?? null,
        ],
      );
      customerId = custResult.rows[0].id as string;

      // Create primary contact
      await client.query(
        `INSERT INTO contacts
         (tenant_id, customer_id, contact_type, is_primary,
          first_name, last_name, display_name, email, phone)
         VALUES ($1, $2, 'primary', TRUE, $3, $4, $5, $6, $7)`,
        [
          tenantId, customerId,
          payload.customer.first_name, payload.customer.last_name,
          displayName, payload.customer.email ?? null, payload.customer.phone ?? null,
        ],
      );
    }

    // 3. Property matching
    let propertyId: string | null = null;

    const propResult = await client.query<Record<string, unknown>>(
      `SELECT id FROM properties
       WHERE customer_id = $1 AND tenant_id = $2
         AND LOWER(address_line1) = LOWER($3) AND LOWER(city) = LOWER($4)
         AND deleted_at IS NULL
       LIMIT 1`,
      [customerId, tenantId, payload.property.address_line1, payload.property.city],
    );

    if (propResult.rows[0]) {
      propertyId = propResult.rows[0].id as string;
    } else {
      const newPropResult = await client.query<Record<string, unknown>>(
        `INSERT INTO properties
         (tenant_id, customer_id, property_name,
          address_line1, address_line2, city, state, zip,
          latitude, longitude, property_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'residential', 'active')
         RETURNING id`,
        [
          tenantId, customerId,
          payload.property.address_line1,
          payload.property.address_line1,
          payload.property.address_line2 ?? null,
          payload.property.city, payload.property.state, payload.property.zip,
          payload.property.latitude ?? null, payload.property.longitude ?? null,
        ],
      );
      propertyId = newPropResult.rows[0].id as string;

      // Auto-set geofence if lat/lng provided
      if (payload.property.latitude != null && payload.property.longitude != null) {
        try {
          const { setDefaultGeofence } = await import('../../geofence/service.js');
          await setDefaultGeofence(
            propertyId!,
            payload.property.latitude,
            payload.property.longitude,
            payload.property.property_category,
          );
        } catch {
          // Geofence setup failure is non-fatal
        }
      }
    }

    // 4. Create job
    const jobNumberResult = await client.query<{ next_val: number }>(
      `INSERT INTO job_number_seq (tenant_id, seq_year, next_val, updated_at)
       VALUES ($1, $2, 2, NOW())
       ON CONFLICT (tenant_id, seq_year)
       DO UPDATE SET next_val = job_number_seq.next_val + 1, updated_at = NOW()
       RETURNING next_val - 1 AS next_val`,
      [tenantId, new Date().getFullYear()],
    );
    const num = jobNumberResult.rows[0].next_val;
    const shortYear = String(new Date().getFullYear()).slice(-2);
    const jobNumber = `${String(num).padStart(4, '0')}-${shortYear}`;

    const division = payload.job.division ?? payload.job.job_type;

    const jobResult = await client.query<Record<string, unknown>>(
      `INSERT INTO jobs
       (tenant_id, customer_id, property_id, job_number,
        job_type, division, title, description, status,
        source_quote_number, source_system, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'quote', $9, 'canopy_quotes', NULL)
       RETURNING id, job_number`,
      [
        tenantId, customerId, propertyId, jobNumber,
        payload.job.job_type, division,
        payload.job.description ?? `Job from Canopy Quotes #${payload.source_quote_number}`,
        payload.job.notes ?? null,
        payload.source_quote_number,
      ],
    );
    const job = jobResult.rows[0];

    // Diary entry
    await client.query(
      `INSERT INTO job_diary_entries
       (tenant_id, job_id, entry_type, title, metadata, is_system_entry)
       VALUES ($1, $2, 'job_created', $3, $4, TRUE)`,
      [
        tenantId, job.id,
        `Job created from Canopy Quotes quote ${payload.source_quote_number}`,
        JSON.stringify({
          source_quote_number: payload.source_quote_number,
          source_system: 'canopy_quotes',
          is_new_customer: isNewCustomer,
        }),
      ],
    );

    await client.query('COMMIT');

    // 5. Log to sync log
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, entity_id, external_id, status)
       VALUES ($1, 'canopy_quotes', 'inbound', 'quote.convert', $2, $3, 'success')`,
      [tenantId, job.id, payload.idempotency_key ?? payload.source_quote_number],
    );

    logger.info('Canopy Quotes conversion complete', {
      job_id: job.id, job_number: jobNumber, is_new_customer: isNewCustomer,
    });

    return {
      crm_job_id: job.id as string,
      job_number: jobNumber,
      customer_id: customerId!,
      property_id: propertyId!,
      is_new_customer: isNewCustomer,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
