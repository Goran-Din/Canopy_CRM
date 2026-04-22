import type pg from 'pg';
import { queryDb, getClient } from '../../config/database.js';

// === Interfaces ===

export interface QuoteV2 {
  id: string;
  tenant_id: string;
  job_id: string;
  quote_number: string;
  version: number;
  status: string;
  subtotal: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  client_notes: string | null;
  payment_terms: string | null;
  internal_notes: string | null;
  template_id: string | null;
  sent_via: string | null;
  sent_to_email: string | null;
  sent_to_phone: string | null;
  sent_at: Date | null;
  signing_token: string | null;
  valid_until: string | null;
  pdf_file_id: string | null;
  signed_pdf_file_id: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  sections?: QuoteSection[];
}

export interface QuoteSection {
  id: string;
  tenant_id: string;
  quote_id: string;
  section_title: string;
  section_body: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  line_items?: QuoteLineItem[];
}

export interface QuoteLineItem {
  id: string;
  tenant_id: string;
  quote_id: string;
  section_id: string;
  xero_item_id: string | null;
  xero_item_code: string | null;
  item_name: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unit_price: string;
  line_total: string;
  is_taxable: boolean;
  sort_order: number;
  is_locked: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface XeroItem {
  id: string;
  tenant_id: string;
  item_code: string;
  item_name: string;
  sales_description: string | null;
  sales_account_code: string | null;
  unit_price: string | null;
}

export interface QuoteTotals {
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_amount: number;
  total_amount: number;
}

// === Quotes ===

export async function insert(
  client: pg.PoolClient,
  quote: Record<string, unknown>,
): Promise<QuoteV2> {
  const result = await client.query<QuoteV2>(
    `INSERT INTO quotes_v2
     (tenant_id, job_id, quote_number, version, status,
      client_notes, payment_terms, internal_notes,
      tax_rate, discount_amount, valid_until, signing_token,
      created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
     RETURNING *`,
    [
      quote.tenant_id,
      quote.job_id,
      quote.quote_number,
      quote.version ?? 1,
      quote.status ?? 'draft',
      quote.client_notes ?? null,
      quote.payment_terms ?? null,
      quote.internal_notes ?? null,
      quote.tax_rate ?? 0,
      quote.discount_amount ?? 0,
      quote.valid_until ?? null,
      quote.signing_token ?? null,
      quote.created_by,
    ],
  );
  return result.rows[0];
}

export async function getById(
  tenantId: string,
  quoteId: string,
): Promise<(QuoteV2 & { sections: QuoteSection[] }) | null> {
  const quoteResult = await queryDb<QuoteV2>(
    `SELECT * FROM quotes_v2
     WHERE id = $1 AND tenant_id = $2`,
    [quoteId, tenantId],
  );

  if (!quoteResult.rows[0]) return null;

  const quote = quoteResult.rows[0];

  // Get sections
  const sectionsResult = await queryDb<QuoteSection>(
    `SELECT * FROM quote_sections
     WHERE quote_id = $1 AND tenant_id = $2
     ORDER BY sort_order ASC, created_at ASC`,
    [quoteId, tenantId],
  );

  // Get line items for all sections
  const sections: QuoteSection[] = [];
  for (const section of sectionsResult.rows) {
    const itemsResult = await queryDb<QuoteLineItem>(
      `SELECT * FROM quote_line_items
       WHERE section_id = $1 AND tenant_id = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [section.id, tenantId],
    );
    sections.push({ ...section, line_items: itemsResult.rows });
  }

  return { ...quote, sections };
}

export async function findByJobId(
  tenantId: string,
  jobId: string,
): Promise<QuoteV2[]> {
  const result = await queryDb<QuoteV2>(
    `SELECT * FROM quotes_v2
     WHERE tenant_id = $1 AND job_id = $2
     ORDER BY version DESC`,
    [tenantId, jobId],
  );
  return result.rows;
}

export async function findActiveByJobId(
  tenantId: string,
  jobId: string,
): Promise<QuoteV2 | null> {
  const result = await queryDb<QuoteV2>(
    `SELECT * FROM quotes_v2
     WHERE tenant_id = $1 AND job_id = $2 AND status = 'draft'
     LIMIT 1`,
    [tenantId, jobId],
  );
  return result.rows[0] || null;
}

export async function updateStatus(
  client: pg.PoolClient,
  quoteId: string,
  status: string,
): Promise<void> {
  await client.query(
    `UPDATE quotes_v2 SET status = $1 WHERE id = $2`,
    [status, quoteId],
  );
}

export async function update(
  client: pg.PoolClient,
  quoteId: string,
  data: Record<string, unknown>,
): Promise<QuoteV2> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['client_notes', data.client_notes],
    ['payment_terms', data.payment_terms],
    ['internal_notes', data.internal_notes],
    ['valid_until', data.valid_until],
    ['tax_rate', data.tax_rate],
    ['discount_amount', data.discount_amount],
    ['sent_via', data.sent_via],
    ['sent_to_email', data.sent_to_email],
    ['sent_to_phone', data.sent_to_phone],
    ['sent_at', data.sent_at],
    ['pdf_file_id', data.pdf_file_id],
    ['signed_pdf_file_id', data.signed_pdf_file_id],
    ['updated_by', data.updated_by],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    const result = await client.query<QuoteV2>(
      `SELECT * FROM quotes_v2 WHERE id = $1`,
      [quoteId],
    );
    return result.rows[0];
  }

  params.push(quoteId);

  const result = await client.query<QuoteV2>(
    `UPDATE quotes_v2 SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx}
     RETURNING *`,
    params,
  );
  return result.rows[0];
}

export async function updateTotals(
  client: pg.PoolClient,
  quoteId: string,
  totals: QuoteTotals,
): Promise<void> {
  await client.query(
    `UPDATE quotes_v2
     SET subtotal = $1, discount_amount = $2, tax_amount = $3, total_amount = $4
     WHERE id = $5`,
    [totals.subtotal, totals.discount_amount, totals.tax_amount, totals.total_amount, quoteId],
  );
}

// === Quote Sections ===

export async function insertSection(
  client: pg.PoolClient,
  section: Record<string, unknown>,
): Promise<QuoteSection> {
  const result = await client.query<QuoteSection>(
    `INSERT INTO quote_sections (tenant_id, quote_id, section_title, section_body, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      section.tenant_id,
      section.quote_id,
      section.title,
      section.body ?? null,
      section.sort_order ?? 0,
    ],
  );
  return result.rows[0];
}

export async function getSectionById(
  tenantId: string,
  sectionId: string,
): Promise<QuoteSection | null> {
  const result = await queryDb<QuoteSection>(
    `SELECT * FROM quote_sections WHERE id = $1 AND tenant_id = $2`,
    [sectionId, tenantId],
  );
  return result.rows[0] || null;
}

export async function updateSection(
  client: pg.PoolClient,
  sectionId: string,
  data: Record<string, unknown>,
): Promise<QuoteSection> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.title !== undefined) {
    setClauses.push(`section_title = $${paramIdx}`);
    params.push(data.title);
    paramIdx++;
  }
  if (data.body !== undefined) {
    setClauses.push(`section_body = $${paramIdx}`);
    params.push(data.body);
    paramIdx++;
  }
  if (data.sort_order !== undefined) {
    setClauses.push(`sort_order = $${paramIdx}`);
    params.push(data.sort_order);
    paramIdx++;
  }

  if (setClauses.length === 0) {
    const result = await client.query<QuoteSection>(
      `SELECT * FROM quote_sections WHERE id = $1`,
      [sectionId],
    );
    return result.rows[0];
  }

  params.push(sectionId);

  const result = await client.query<QuoteSection>(
    `UPDATE quote_sections SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx}
     RETURNING *`,
    params,
  );
  return result.rows[0];
}

export async function deleteSection(
  client: pg.PoolClient,
  sectionId: string,
): Promise<void> {
  await client.query('DELETE FROM quote_sections WHERE id = $1', [sectionId]);
}

// === Quote Line Items ===

export async function insertLineItem(
  client: pg.PoolClient,
  item: Record<string, unknown>,
): Promise<QuoteLineItem> {
  const result = await client.query<QuoteLineItem>(
    `INSERT INTO quote_line_items
     (tenant_id, quote_id, section_id, xero_item_id, item_name, description,
      quantity, unit, unit_price, line_total, is_taxable, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      item.tenant_id,
      item.quote_id,
      item.section_id,
      item.xero_item_id ?? null,
      item.item_name,
      item.description ?? null,
      item.quantity,
      item.unit ?? 'each',
      item.unit_price,
      item.line_total,
      item.is_taxable ?? false,
      item.sort_order ?? 0,
    ],
  );
  return result.rows[0];
}

export async function getLineItemById(
  tenantId: string,
  itemId: string,
): Promise<QuoteLineItem | null> {
  const result = await queryDb<QuoteLineItem>(
    `SELECT * FROM quote_line_items WHERE id = $1 AND tenant_id = $2`,
    [itemId, tenantId],
  );
  return result.rows[0] || null;
}

export async function updateLineItem(
  client: pg.PoolClient,
  itemId: string,
  data: Record<string, unknown>,
): Promise<QuoteLineItem> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['item_name', data.item_name],
    ['description', data.description],
    ['quantity', data.quantity],
    ['unit', data.unit],
    ['unit_price', data.unit_price],
    ['line_total', data.line_total],
    ['is_taxable', data.is_taxable],
    ['sort_order', data.sort_order],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    const result = await client.query<QuoteLineItem>(
      `SELECT * FROM quote_line_items WHERE id = $1`,
      [itemId],
    );
    return result.rows[0];
  }

  params.push(itemId);

  const result = await client.query<QuoteLineItem>(
    `UPDATE quote_line_items SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx}
     RETURNING *`,
    params,
  );
  return result.rows[0];
}

export async function deleteLineItem(
  client: pg.PoolClient,
  itemId: string,
): Promise<void> {
  await client.query('DELETE FROM quote_line_items WHERE id = $1', [itemId]);
}

export async function findLineItemsByQuoteId(
  tenantId: string,
  quoteId: string,
): Promise<QuoteLineItem[]> {
  const result = await queryDb<QuoteLineItem>(
    `SELECT * FROM quote_line_items
     WHERE quote_id = $1 AND tenant_id = $2
     ORDER BY sort_order ASC`,
    [quoteId, tenantId],
  );
  return result.rows;
}

/**
 * Copy all sections and line items from one quote to another.
 */
export async function copyQuoteContent(
  client: pg.PoolClient,
  sourceQuoteId: string,
  targetQuoteId: string,
  tenantId: string,
): Promise<void> {
  // Get source sections
  const sectionsResult = await client.query<QuoteSection>(
    `SELECT * FROM quote_sections WHERE quote_id = $1 ORDER BY sort_order ASC`,
    [sourceQuoteId],
  );

  for (const section of sectionsResult.rows) {
    // Create new section in target quote
    const newSectionResult = await client.query<QuoteSection>(
      `INSERT INTO quote_sections (tenant_id, quote_id, section_title, section_body, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, targetQuoteId, section.section_title, section.section_body, section.sort_order],
    );
    const newSection = newSectionResult.rows[0];

    // Copy line items
    const itemsResult = await client.query<QuoteLineItem>(
      `SELECT * FROM quote_line_items WHERE section_id = $1 ORDER BY sort_order ASC`,
      [section.id],
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO quote_line_items
         (tenant_id, quote_id, section_id, xero_item_id, xero_item_code,
          item_name, description, quantity, unit, unit_price, line_total,
          is_taxable, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          tenantId, targetQuoteId, newSection.id, item.xero_item_id, item.xero_item_code,
          item.item_name, item.description, item.quantity, item.unit, item.unit_price,
          item.line_total, item.is_taxable, item.sort_order,
        ],
      );
    }
  }
}

// === Quote Number Sequence ===

interface SeqRow {
  next_val: number;
}

export async function getNextQuoteNumber(
  client: pg.PoolClient,
  tenantId: string,
): Promise<string> {
  // Reuse job_number_seq pattern but with a separate key prefix
  const year = new Date().getFullYear();
  const shortYear = String(year).slice(-2);

  const result = await client.query<SeqRow>(
    `INSERT INTO job_number_seq (tenant_id, seq_year, next_val, updated_at)
     VALUES ($1, $2, 2, NOW())
     ON CONFLICT (tenant_id, seq_year)
     DO UPDATE SET next_val = job_number_seq.next_val + 1, updated_at = NOW()
     RETURNING next_val - 1 AS next_val`,
    [tenantId, year + 10000], // offset to avoid colliding with job numbers
  );

  const num = result.rows[0].next_val;
  return `Q-${String(num).padStart(4, '0')}-${shortYear}`;
}

// === Xero Item Search ===

export async function searchXeroItems(
  tenantId: string,
  search: string,
): Promise<XeroItem[]> {
  const result = await queryDb<XeroItem>(
    `SELECT id, item_code, item_name, sales_description, sales_account_code, unit_price
     FROM xero_items
     WHERE tenant_id = $1
       AND is_active = TRUE
       AND is_sold = TRUE
       AND (item_code ILIKE $2 OR item_name ILIKE $2 OR sales_description ILIKE $2)
     ORDER BY CASE WHEN item_code ILIKE $3 THEN 0 ELSE 1 END, item_code ASC
     LIMIT 10`,
    [tenantId, `%${search}%`, `${search}%`],
  );
  return result.rows;
}

// === Helpers ===

export async function acquireClient(): Promise<pg.PoolClient> {
  return getClient();
}
