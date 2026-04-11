import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';
import { MauticClient } from './mautic-client.js';

function isMauticEnabled(): boolean {
  return process.env.MAUTIC_ENABLED === 'true';
}

async function getMauticClient(tenantId: string): Promise<{ client: MauticClient; config: Record<string, unknown> } | null> {
  const result = await queryDb<Record<string, unknown>>(
    `SELECT config_data FROM integration_configs
     WHERE tenant_id = $1 AND provider = 'mautic' AND status = 'active'`,
    [tenantId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const data = row.config_data as Record<string, unknown>;
  const baseUrl = (data.base_url as string) || process.env.MAUTIC_BASE_URL || '';
  const apiKey = (data.api_key as string) || process.env.MAUTIC_API_KEY || '';
  if (!baseUrl || !apiKey) return null;

  return { client: new MauticClient({ baseUrl, apiKey }), config: data };
}

async function logSync(
  tenantId: string,
  eventType: string,
  entityId: string,
  status: string,
  error?: string,
) {
  try {
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, entity_id, status, error_message)
       VALUES ($1, 'mautic', 'outbound', $2, $3, $4, $5)`,
      [tenantId, eventType, entityId, status, error ?? null],
    );
  } catch {
    // Non-fatal
  }
}

// === Expired Quote Push ===

export async function pushExpiredQuote(tenantId: string, quoteId: string): Promise<void> {
  if (!isMauticEnabled()) return;

  try {
    const quoteResult = await queryDb<Record<string, unknown>>(
      `SELECT q.*, j.job_type, j.property_id,
              c.first_name, c.last_name, c.email, c.phone,
              p.address_line1, p.city
       FROM quotes_v2 q
       JOIN jobs j ON j.id = q.job_id
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN properties p ON p.id = j.property_id
       WHERE q.id = $1 AND q.tenant_id = $2`,
      [quoteId, tenantId],
    );
    const quote = quoteResult.rows[0];
    if (!quote) return;

    const email = quote.email as string;
    if (!email) {
      await logSync(tenantId, 'quote.expired', quoteId, 'skipped', 'No customer email');
      return;
    }

    const mautic = await getMauticClient(tenantId);
    if (!mautic) return;

    const result = await mautic.client.pushContact({
      email,
      firstname: quote.first_name as string,
      lastname: quote.last_name as string,
      phone: quote.phone as string,
      tags: ['crm_quote_expired'],
      customFields: {
        crm_customer_id: quote.customer_id ?? (quote as Record<string, unknown>).customer_id,
        quote_number: quote.quote_number,
        quote_amount: quote.total_amount,
        property_address: `${quote.address_line1 ?? ''}, ${quote.city ?? ''}`,
        service_type: quote.job_type,
        expired_at: quote.valid_until,
        source: 'canopy_crm',
      },
    });

    if (result.success && result.mautic_contact_id) {
      const segmentId = (mautic.config.expired_quotes_segment_id as string) ?? '';
      if (segmentId) {
        await mautic.client.addToSegment(result.mautic_contact_id, segmentId);
      }
    }

    await logSync(tenantId, 'quote.expired', quoteId,
      result.success ? 'success' : 'failed', result.error);

    if (!result.success) {
      logger.error('Mautic expired quote push failed', { quoteId, error: result.error });
    }
  } catch (err) {
    logger.error('Mautic pushExpiredQuote error', { error: (err as Error).message });
    await logSync(tenantId, 'quote.expired', quoteId, 'failed', (err as Error).message);
  }
}

// === Declined Quote Push ===

export async function pushDeclinedQuote(tenantId: string, quoteId: string): Promise<void> {
  if (!isMauticEnabled()) return;

  try {
    const quoteResult = await queryDb<Record<string, unknown>>(
      `SELECT q.*, j.job_type, j.property_id,
              c.first_name, c.last_name, c.email, c.phone,
              p.address_line1, p.city
       FROM quotes_v2 q
       JOIN jobs j ON j.id = q.job_id
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN properties p ON p.id = j.property_id
       WHERE q.id = $1 AND q.tenant_id = $2`,
      [quoteId, tenantId],
    );
    const quote = quoteResult.rows[0];
    if (!quote) return;

    const email = quote.email as string;
    if (!email) {
      await logSync(tenantId, 'quote.declined', quoteId, 'skipped', 'No customer email');
      return;
    }

    const mautic = await getMauticClient(tenantId);
    if (!mautic) return;

    const result = await mautic.client.pushContact({
      email,
      firstname: quote.first_name as string,
      lastname: quote.last_name as string,
      phone: quote.phone as string,
      tags: ['crm_quote_declined'],
      customFields: {
        crm_customer_id: quote.customer_id,
        quote_number: quote.quote_number,
        quote_amount: quote.total_amount,
        property_address: `${quote.address_line1 ?? ''}, ${quote.city ?? ''}`,
        service_type: quote.job_type,
        decline_reason: quote.decline_reason,
        declined_at: quote.declined_at,
        source: 'canopy_crm',
      },
    });

    if (result.success && result.mautic_contact_id) {
      const segmentId = (mautic.config.lost_quotes_segment_id as string) ?? '';
      if (segmentId) {
        await mautic.client.addToSegment(result.mautic_contact_id, segmentId);
      }
    }

    await logSync(tenantId, 'quote.declined', quoteId,
      result.success ? 'success' : 'failed', result.error);

    if (!result.success) {
      logger.error('Mautic declined quote push failed', { quoteId, error: result.error });
    }
  } catch (err) {
    logger.error('Mautic pushDeclinedQuote error', { error: (err as Error).message });
    await logSync(tenantId, 'quote.declined', quoteId, 'failed', (err as Error).message);
  }
}

// === Bronze Upsell Push ===

export async function pushBronzeUpsellFlag(tenantId: string, customerId: string): Promise<void> {
  if (!isMauticEnabled()) return;

  try {
    const customerResult = await queryDb<Record<string, unknown>>(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.phone
       FROM customers c
       WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL`,
      [customerId, tenantId],
    );
    const customer = customerResult.rows[0];
    if (!customer) return;

    const email = customer.email as string;
    if (!email) {
      await logSync(tenantId, 'bronze.upsell', customerId, 'skipped', 'No customer email');
      return;
    }

    // Check add-on history across seasons
    const addonResult = await queryDb<Record<string, unknown>>(
      `SELECT sc.xero_item_code, EXTRACT(YEAR FROM sc.season_start_date)::int AS season_year
       FROM service_contracts sc2
       JOIN service_contracts sc ON sc.customer_id = sc2.customer_id AND sc.tenant_id = sc2.tenant_id
       WHERE sc2.customer_id = $1 AND sc2.tenant_id = $2
         AND sc2.service_tier = 'bronze'
         AND sc.xero_item_code IS NOT NULL
         AND sc.deleted_at IS NULL
       GROUP BY sc.xero_item_code, season_year
       ORDER BY sc.xero_item_code, season_year`,
      [customerId, tenantId],
    );

    // Find add-ons that appear in 2+ consecutive seasons
    const addonsByCode = new Map<string, number[]>();
    for (const row of addonResult.rows) {
      const code = row.xero_item_code as string;
      const year = row.season_year as number;
      if (!addonsByCode.has(code)) addonsByCode.set(code, []);
      addonsByCode.get(code)!.push(year);
    }

    const recurringAddons: string[] = [];
    let maxConsecutive = 0;
    for (const [code, years] of addonsByCode) {
      years.sort((a, b) => a - b);
      let consecutive = 1;
      for (let i = 1; i < years.length; i++) {
        if (years[i] === years[i - 1] + 1) {
          consecutive++;
        } else {
          consecutive = 1;
        }
      }
      if (consecutive >= 2) {
        recurringAddons.push(code);
        maxConsecutive = Math.max(maxConsecutive, consecutive);
      }
    }

    if (recurringAddons.length === 0) return; // Not a candidate

    const mautic = await getMauticClient(tenantId);
    if (!mautic) return;

    const result = await mautic.client.pushContact({
      email,
      firstname: customer.first_name as string,
      lastname: customer.last_name as string,
      phone: customer.phone as string,
      tags: ['crm_bronze_upsell'],
      customFields: {
        crm_customer_id: customer.id,
        current_tier: 'bronze',
        recommended_tier: recurringAddons.length >= 3 ? 'gold' : 'silver',
        recurring_addons: recurringAddons,
        seasons_with_addons: maxConsecutive,
        source: 'canopy_crm',
      },
    });

    if (result.success && result.mautic_contact_id) {
      const segmentId = (mautic.config.bronze_upsell_segment_id as string) ?? '';
      if (segmentId) {
        await mautic.client.addToSegment(result.mautic_contact_id, segmentId);
      }
    }

    await logSync(tenantId, 'bronze.upsell', customerId,
      result.success ? 'success' : 'failed', result.error);
  } catch (err) {
    logger.error('Mautic pushBronzeUpsellFlag error', { error: (err as Error).message });
    await logSync(tenantId, 'bronze.upsell', customerId, 'failed', (err as Error).message);
  }
}
