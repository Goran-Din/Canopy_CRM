import { queryDb } from '../../config/database.js';

// === Interfaces ===

export interface CustomerFeedback {
  id: string;
  tenant_id: string;
  customer_id: string;
  invoice_id: string | null;
  job_id: string | null;
  feedback_token: string;
  sent_via: string;
  sent_at: Date;
  rating: number | null;
  comment: string | null;
  responded_at: Date | null;
  respondent_ip: string | null;
  google_review_prompted: boolean;
  google_review_clicked: boolean;
  status: string;
  staff_note: string | null;
  staff_note_by: string | null;
  staff_noted_at: Date | null;
  created_at: Date;
  // Joined fields
  customer_name?: string;
  job_number?: string;
  property_address?: string;
  customer_first_name?: string;
}

export interface FeedbackSummary {
  avg_rating: string | null;
  total_sent: string;
  total_responded: string;
  response_rate: string;
  rating_1: string;
  rating_2: string;
  rating_3: string;
  rating_4: string;
  rating_5: string;
  google_review_clicked: string;
}

interface CountRow { count: string }

// === Create ===

export async function create(
  data: Record<string, unknown>,
): Promise<CustomerFeedback> {
  const result = await queryDb<CustomerFeedback>(
    `INSERT INTO customer_feedback
     (tenant_id, customer_id, invoice_id, job_id, feedback_token,
      sent_via, sent_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'sent')
     RETURNING *`,
    [
      data.tenant_id,
      data.customer_id,
      data.invoice_id ?? null,
      data.job_id ?? null,
      data.feedback_token,
      data.sent_via ?? 'email',
    ],
  );
  return result.rows[0];
}

// === Token Lookup ===

export async function findByToken(
  token: string,
): Promise<CustomerFeedback | null> {
  const result = await queryDb<CustomerFeedback>(
    `SELECT cf.*,
            c.display_name AS customer_name,
            c.first_name AS customer_first_name,
            j.job_number,
            p.address_line1 AS property_address
     FROM customer_feedback cf
     LEFT JOIN customers c ON c.id = cf.customer_id
     LEFT JOIN jobs j ON j.id = cf.job_id
     LEFT JOIN properties p ON p.id = j.property_id
     WHERE cf.feedback_token = $1`,
    [token],
  );
  return result.rows[0] || null;
}

// === Submit Feedback ===

export async function submitFeedback(
  token: string,
  data: { rating: number; comment?: string; respondentIp?: string },
): Promise<CustomerFeedback> {
  const googlePrompted = data.rating >= 4;
  const result = await queryDb<CustomerFeedback>(
    `UPDATE customer_feedback
     SET rating = $1,
         comment = $2,
         responded_at = NOW(),
         respondent_ip = $3,
         status = 'responded',
         google_review_prompted = $4
     WHERE feedback_token = $5
     RETURNING *`,
    [
      data.rating,
      data.comment ?? null,
      data.respondentIp ?? null,
      googlePrompted,
      token,
    ],
  );
  return result.rows[0];
}

// === Find All (Staff) ===

export interface FeedbackFilters {
  status?: string;
  rating?: number;
  date_from?: string;
  date_to?: string;
  customer_id?: string;
  page?: number;
  limit?: number;
}

export async function findAll(
  tenantId: string,
  filters: FeedbackFilters,
): Promise<{ data: CustomerFeedback[]; total: number; page: number; limit: number }> {
  const conditions: string[] = ['cf.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (filters.status) {
    conditions.push(`cf.status = $${paramIdx}`);
    params.push(filters.status);
    paramIdx++;
  }
  if (filters.rating) {
    conditions.push(`cf.rating = $${paramIdx}`);
    params.push(filters.rating);
    paramIdx++;
  }
  if (filters.date_from) {
    conditions.push(`cf.responded_at >= $${paramIdx}`);
    params.push(filters.date_from);
    paramIdx++;
  }
  if (filters.date_to) {
    conditions.push(`cf.responded_at <= $${paramIdx}`);
    params.push(filters.date_to);
    paramIdx++;
  }
  if (filters.customer_id) {
    conditions.push(`cf.customer_id = $${paramIdx}`);
    params.push(filters.customer_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM customer_feedback cf WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<CustomerFeedback>(
    `SELECT cf.*, c.display_name AS customer_name, j.job_number
     FROM customer_feedback cf
     LEFT JOIN customers c ON c.id = cf.customer_id
     LEFT JOIN jobs j ON j.id = cf.job_id
     WHERE ${where}
     ORDER BY cf.responded_at DESC NULLS LAST, cf.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );

  return { data: dataResult.rows, total, page, limit };
}

// === Summary ===

export async function getSummary(
  tenantId: string,
): Promise<FeedbackSummary> {
  const result = await queryDb<FeedbackSummary>(
    `SELECT
       ROUND(AVG(rating)::numeric, 1)::text AS avg_rating,
       COUNT(*)::text AS total_sent,
       COUNT(*) FILTER (WHERE status = 'responded')::text AS total_responded,
       CASE WHEN COUNT(*) > 0
         THEN ROUND((COUNT(*) FILTER (WHERE status = 'responded')::numeric / COUNT(*)::numeric) * 100, 1)::text
         ELSE '0'
       END AS response_rate,
       COUNT(*) FILTER (WHERE rating = 1)::text AS rating_1,
       COUNT(*) FILTER (WHERE rating = 2)::text AS rating_2,
       COUNT(*) FILTER (WHERE rating = 3)::text AS rating_3,
       COUNT(*) FILTER (WHERE rating = 4)::text AS rating_4,
       COUNT(*) FILTER (WHERE rating = 5)::text AS rating_5,
       COUNT(*) FILTER (WHERE google_review_clicked = TRUE)::text AS google_review_clicked
     FROM customer_feedback
     WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0];
}

export async function getRecentFeedback(
  tenantId: string,
  limit = 5,
): Promise<CustomerFeedback[]> {
  const result = await queryDb<CustomerFeedback>(
    `SELECT cf.*, c.display_name AS customer_name, j.job_number
     FROM customer_feedback cf
     LEFT JOIN customers c ON c.id = cf.customer_id
     LEFT JOIN jobs j ON j.id = cf.job_id
     WHERE cf.tenant_id = $1 AND cf.status = 'responded'
     ORDER BY cf.responded_at DESC
     LIMIT $2`,
    [tenantId, limit],
  );
  return result.rows;
}

// === Staff Note ===

export async function addStaffNote(
  id: string,
  tenantId: string,
  note: string,
  userId: string,
): Promise<CustomerFeedback> {
  const result = await queryDb<CustomerFeedback>(
    `UPDATE customer_feedback
     SET staff_note = $1, staff_note_by = $2, staff_noted_at = NOW()
     WHERE id = $3 AND tenant_id = $4
     RETURNING *`,
    [note, userId, id, tenantId],
  );
  return result.rows[0];
}

// === Expiry ===

export async function expireOldFeedback(): Promise<number> {
  const result = await queryDb(
    `UPDATE customer_feedback
     SET status = 'expired'
     WHERE status = 'sent'
       AND sent_at < NOW() - INTERVAL '14 days'`,
  );
  return result.rowCount ?? 0;
}

// === Google Review Click ===

export async function markReviewClicked(
  token: string,
): Promise<CustomerFeedback | null> {
  const result = await queryDb<CustomerFeedback>(
    `UPDATE customer_feedback
     SET google_review_clicked = TRUE
     WHERE feedback_token = $1
     RETURNING *`,
    [token],
  );
  return result.rows[0] || null;
}

// === Find By ID ===

export async function findById(
  id: string,
  tenantId: string,
): Promise<CustomerFeedback | null> {
  const result = await queryDb<CustomerFeedback>(
    `SELECT * FROM customer_feedback WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}
