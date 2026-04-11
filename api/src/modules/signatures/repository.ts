import type pg from 'pg';
import { queryDb, getClient } from '../../config/database.js';

export interface QuoteForSigning {
  id: string;
  tenant_id: string;
  job_id: string;
  customer_id: string;
  property_id: string;
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
  valid_until: string | null;
  signing_token: string;
  pdf_file_id: string | null;
  created_at: Date;
  // Joined fields
  customer_name: string;
  customer_email: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  sections: unknown;
}

export interface QuoteSignature {
  id: string;
  tenant_id: string;
  quote_id: string;
  signer_name: string;
  signature_file_id: string;
  signed_at: Date;
  signer_ip_address: string;
  user_agent: string | null;
  signing_token_used: string;
  agreement_checked: boolean;
  created_at: Date;
}

export interface SignatureInsert {
  tenant_id: string;
  quote_id: string;
  signer_name: string;
  signature_file_id: string;
  signed_at: Date;
  signer_ip_address: string;
  user_agent: string;
  signing_token_used: string;
  agreement_checked: boolean;
}

/**
 * Get quote by signing token (PUBLIC — no tenant_id required).
 * Includes customer info, property address, and sections with line items.
 */
export async function findBySigningToken(token: string): Promise<QuoteForSigning | null> {
  const result = await queryDb<QuoteForSigning>(
    `SELECT q.*,
            c.display_name AS customer_name,
            c.email AS customer_email,
            p.street_address, p.city, p.state, p.zip_code,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', qs.id,
                  'title', qs.section_title,
                  'body', qs.section_body,
                  'sort_order', qs.sort_order,
                  'line_items', (
                    SELECT COALESCE(json_agg(
                      json_build_object(
                        'id', qli.id,
                        'item_name', qli.item_name,
                        'description', qli.description,
                        'quantity', qli.quantity,
                        'unit', qli.unit,
                        'unit_price', qli.unit_price,
                        'line_total', qli.line_total,
                        'is_taxable', qli.is_taxable
                      ) ORDER BY qli.sort_order
                    ), '[]'::json)
                    FROM quote_line_items qli WHERE qli.section_id = qs.id
                  )
                ) ORDER BY qs.sort_order
              ) FILTER (WHERE qs.id IS NOT NULL),
              '[]'::json
            ) AS sections
     FROM quotes_v2 q
     JOIN customers c ON c.id = q.customer_id
     JOIN properties p ON p.id = q.property_id
     LEFT JOIN quote_sections qs ON qs.quote_id = q.id
     WHERE q.signing_token = $1
     GROUP BY q.id, c.display_name, c.email,
              p.street_address, p.city, p.state, p.zip_code`,
    [token],
  );
  return result.rows[0] ?? null;
}

/**
 * Lock quote row for signing (SELECT FOR UPDATE within transaction).
 */
export async function lockQuoteByToken(
  client: pg.PoolClient,
  token: string,
): Promise<QuoteForSigning | null> {
  const result = await client.query<QuoteForSigning>(
    `SELECT q.*,
            c.display_name AS customer_name,
            c.email AS customer_email,
            p.street_address, p.city, p.state, p.zip_code
     FROM quotes_v2 q
     JOIN customers c ON c.id = q.customer_id
     JOIN properties p ON p.id = q.property_id
     WHERE q.signing_token = $1
     FOR UPDATE OF q`,
    [token],
  );
  return result.rows[0] ?? null;
}

/**
 * Insert signature record (IMMUTABLE — no update, no delete).
 */
export async function insertSignature(
  client: pg.PoolClient,
  sig: SignatureInsert,
): Promise<QuoteSignature> {
  const result = await client.query<QuoteSignature>(
    `INSERT INTO quote_signatures
     (tenant_id, quote_id, signer_name, signature_file_id, signed_at,
      signer_ip_address, user_agent, signing_token_used, agreement_checked)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      sig.tenant_id, sig.quote_id, sig.signer_name, sig.signature_file_id,
      sig.signed_at, sig.signer_ip_address, sig.user_agent,
      sig.signing_token_used, sig.agreement_checked,
    ],
  );
  return result.rows[0];
}

/**
 * Get signature by quote ID (staff only — requires tenant scoping).
 */
export async function findByQuoteId(
  tenantId: string,
  quoteId: string,
): Promise<QuoteSignature | null> {
  const result = await queryDb<QuoteSignature>(
    `SELECT * FROM quote_signatures
     WHERE tenant_id = $1 AND quote_id = $2`,
    [tenantId, quoteId],
  );
  return result.rows[0] ?? null;
}

/**
 * Acquire a database client for transactions.
 */
export async function acquireClient(): Promise<pg.PoolClient> {
  return getClient();
}
