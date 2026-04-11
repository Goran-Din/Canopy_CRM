import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';

// === Xero Items Repository ===

export interface XeroItemRow {
  id: string;
  tenant_id: string;
  xero_item_id: string;
  item_code: string;
  item_name: string;
  sales_description: string | null;
  sales_account_code: string | null;
  unit_price: string | null;
  is_active: boolean;
  is_sold: boolean;
  last_synced_at: Date | null;
  xero_updated_at: string | null;
}

export async function findByXeroId(
  tenantId: string,
  xeroItemId: string,
): Promise<XeroItemRow | null> {
  const result = await queryDb<XeroItemRow>(
    `SELECT * FROM xero_items WHERE tenant_id = $1 AND xero_item_id = $2`,
    [tenantId, xeroItemId],
  );
  return result.rows[0] || null;
}

export async function insert(data: Record<string, unknown>): Promise<XeroItemRow> {
  const result = await queryDb<XeroItemRow>(
    `INSERT INTO xero_items
     (tenant_id, xero_item_id, item_code, item_name, sales_description,
      sales_account_code, unit_price, is_active, is_sold, last_synced_at, xero_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
     RETURNING *`,
    [
      data.tenant_id, data.xero_item_id, data.item_code, data.item_name,
      data.sales_description ?? null, data.sales_account_code ?? null,
      data.unit_price ?? null, data.is_active ?? true, data.is_sold ?? false,
      data.xero_updated_at ?? null,
    ],
  );
  return result.rows[0];
}

export async function update(id: string, data: Record<string, unknown>): Promise<XeroItemRow> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['item_code', data.item_code],
    ['item_name', data.item_name],
    ['sales_description', data.sales_description],
    ['sales_account_code', data.sales_account_code],
    ['unit_price', data.unit_price],
    ['is_active', data.is_active],
    ['is_sold', data.is_sold],
    ['last_synced_at', new Date()],
    ['xero_updated_at', data.xero_updated_at],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  params.push(id);
  const result = await queryDb<XeroItemRow>(
    `UPDATE xero_items SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );
  return result.rows[0];
}

export async function listAll(tenantId: string): Promise<XeroItemRow[]> {
  const result = await queryDb<XeroItemRow>(
    `SELECT * FROM xero_items WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows;
}

export async function deactivateNotInSet(
  tenantId: string,
  activeXeroIds: string[],
): Promise<number> {
  if (activeXeroIds.length === 0) return 0;
  const placeholders = activeXeroIds.map((_, i) => `$${i + 2}`).join(', ');
  const result = await queryDb(
    `UPDATE xero_items SET is_active = FALSE
     WHERE tenant_id = $1 AND is_active = TRUE AND xero_item_id NOT IN (${placeholders})`,
    [tenantId, ...activeXeroIds],
  );
  return result.rowCount ?? 0;
}

export async function search(
  tenantId: string,
  searchTerm: string,
  limit = 10,
): Promise<XeroItemRow[]> {
  const result = await queryDb<XeroItemRow>(
    `SELECT * FROM xero_items
     WHERE tenant_id = $1
       AND is_active = TRUE
       AND is_sold = TRUE
       AND (item_code ILIKE $2 OR item_name ILIKE $2 OR sales_description ILIKE $2)
     ORDER BY CASE WHEN item_code ILIKE $3 THEN 0 ELSE 1 END, item_code ASC
     LIMIT $4`,
    [tenantId, `%${searchTerm}%`, `${searchTerm}%`, limit],
  );
  return result.rows;
}

// === Xero Items Sync ===

interface SyncResult {
  synced_at: string;
  items_added: number;
  items_updated: number;
  items_deactivated: number;
  errors: Array<{ item_code: string; error: string }>;
}

export async function syncXeroItems(
  tenantId: string,
  isManual = false,
): Promise<SyncResult> {
  const result: SyncResult = {
    synced_at: new Date().toISOString(),
    items_added: 0,
    items_updated: 0,
    items_deactivated: 0,
    errors: [],
  };

  try {
    // Call Xero Items API via xero-client
    const { xeroRequest } = await import('./xero-client.js');
    const xeroResponse = await xeroRequest(tenantId, 'GET', '/Items', null);
    const xeroItems = xeroResponse?.Items ?? [];

    const xeroIdSet: string[] = [];

    for (const xItem of xeroItems) {
      try {
        const xeroItemId = xItem.ItemID as string;
        xeroIdSet.push(xeroItemId);

        const existing = await findByXeroId(tenantId, xeroItemId);
        const mapped = {
          tenant_id: tenantId,
          xero_item_id: xeroItemId,
          item_code: xItem.Code ?? '',
          item_name: xItem.Name ?? '',
          sales_description: xItem.SalesDetails?.Description ?? null,
          sales_account_code: xItem.SalesDetails?.AccountCode ?? null,
          unit_price: xItem.SalesDetails?.UnitPrice ?? null,
          is_active: true,
          is_sold: !!xItem.SalesDetails,
          xero_updated_at: xItem.UpdatedDateUTC ?? null,
        };

        if (!existing) {
          await insert(mapped);
          result.items_added++;
        } else if (existing.xero_updated_at !== mapped.xero_updated_at) {
          await update(existing.id, mapped);
          result.items_updated++;
        }
      } catch (err) {
        result.errors.push({
          item_code: xItem.Code ?? 'unknown',
          error: (err as Error).message,
        });
      }
    }

    // Deactivate items no longer in Xero
    if (xeroIdSet.length > 0) {
      result.items_deactivated = await deactivateNotInSet(tenantId, xeroIdSet);
    }

    // Log
    const eventType = isManual ? 'items.sync.manual' : 'items.sync.nightly';
    await logSyncEvent(tenantId, eventType, result.errors.length === 0 ? 'success' : 'partial',
      JSON.stringify(result));

    logger.info('Xero items sync complete', result);
  } catch (err) {
    logger.error('Xero items sync failed', { error: (err as Error).message });
    await logSyncEvent(tenantId, 'items.sync.error', 'failed', (err as Error).message);
    throw err;
  }

  return result;
}

async function logSyncEvent(
  tenantId: string,
  eventType: string,
  status: string,
  detail: string,
) {
  try {
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, status, error_message)
       VALUES ($1, 'xero', 'internal', $2, $3, $4)`,
      [tenantId, eventType, status, detail],
    );
  } catch {
    // Non-fatal
  }
}
