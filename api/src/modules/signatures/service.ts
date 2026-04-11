import { AppError } from '../../middleware/errorHandler.js';
import * as repo from './repository.js';
import * as fileRepo from '../files/repository.js';
import * as diaryRepo from '../jobs/diary/diary.repository.js';
import * as r2 from '../files/r2.client.js';
import type { SubmitSignatureInput } from './schema.js';

/**
 * Get quote data for public signing page.
 */
export async function getSigningPageData(token: string) {
  const quote = await repo.findBySigningToken(token);

  if (!quote) {
    throw new AppError(401, 'Invalid or expired link');
  }

  // Check valid_until
  if (quote.valid_until && new Date() > new Date(quote.valid_until)) {
    // Auto-expire if date has passed
    if (quote.status !== 'expired') {
      const client = await repo.acquireClient();
      try {
        await client.query(
          `UPDATE quotes_v2 SET status = 'expired' WHERE id = $1`,
          [quote.id],
        );
      } finally {
        client.release();
      }
    }
    throw new AppError(401, 'This quote has expired');
  }

  if (quote.status === 'signed') {
    return {
      already_signed: true,
      quote_number: quote.quote_number,
      message: 'This quote has already been signed',
    };
  }

  if (quote.status === 'expired') {
    throw new AppError(401, 'This quote has expired');
  }

  if (quote.status === 'superseded') {
    throw new AppError(401, 'A newer version has been sent');
  }

  if (quote.status !== 'sent' && quote.status !== 'viewed') {
    throw new AppError(401, 'Invalid or expired link');
  }

  // Mark as viewed if currently 'sent'
  if (quote.status === 'sent') {
    const client = await repo.acquireClient();
    try {
      await client.query(
        `UPDATE quotes_v2 SET status = 'viewed' WHERE id = $1`,
        [quote.id],
      );
    } finally {
      client.release();
    }
  }

  // Return quote data for signing page (no internal notes, no signing token)
  return {
    already_signed: false,
    quote_number: quote.quote_number,
    version: quote.version,
    customer_name: quote.customer_name,
    street_address: quote.street_address,
    city: quote.city,
    state: quote.state,
    zip_code: quote.zip_code,
    subtotal: quote.subtotal,
    discount_amount: quote.discount_amount,
    tax_amount: quote.tax_amount,
    total_amount: quote.total_amount,
    client_notes: quote.client_notes,
    payment_terms: quote.payment_terms,
    valid_until: quote.valid_until,
    sections: quote.sections,
  };
}

/**
 * Process signature submission — 9 steps in single transaction.
 */
export async function processSignature(
  input: SubmitSignatureInput,
  clientIp: string,
  userAgent: string,
) {
  const client = await repo.acquireClient();

  try {
    await client.query('BEGIN');

    // STEP 1: Validate token & lock quote row
    const quote = await repo.lockQuoteByToken(client, input.signing_token);

    if (!quote) {
      throw new AppError(401, 'Invalid or expired link');
    }

    if (quote.status === 'signed') {
      throw new AppError(409, 'Already signed');
    }

    if (quote.status === 'expired' || quote.status === 'superseded') {
      throw new AppError(401, quote.status === 'expired'
        ? 'This quote has expired'
        : 'A newer version has been sent');
    }

    // Check valid_until
    if (quote.valid_until && new Date() > new Date(quote.valid_until)) {
      await client.query(
        `UPDATE quotes_v2 SET status = 'expired' WHERE id = $1`,
        [quote.id],
      );
      await client.query('COMMIT');
      throw new AppError(401, 'This quote has expired');
    }

    if (quote.status !== 'sent' && quote.status !== 'viewed') {
      throw new AppError(401, 'Invalid or expired link');
    }

    // STEP 2: Upload signature image to R2
    const sigR2Key = `${quote.tenant_id}/clients/${quote.customer_id}/signatures/${quote.id}_sig.png`;
    const sigBuffer = Buffer.from(input.signature_image_base64, 'base64');
    await r2.uploadBuffer(sigR2Key, sigBuffer, 'image/png');

    // STEP 3: Create client_files record for signature image
    const sigFile = await fileRepo.insertFile(client, {
      tenant_id: quote.tenant_id,
      customer_id: quote.customer_id,
      r2_key: sigR2Key,
      file_name: `signature_${quote.quote_number}.png`,
      file_size_bytes: sigBuffer.length,
      mime_type: 'image/png',
      file_category: 'signature',
      portal_visible: false,
      uploaded_by_client: true,
      upload_source: 'client_portal',
    });

    // STEP 4: Create quote_signatures record (immutable audit trail)
    await repo.insertSignature(client, {
      tenant_id: quote.tenant_id,
      quote_id: quote.id,
      signer_name: input.signer_name,
      signature_file_id: sigFile.id,
      signed_at: new Date(),
      signer_ip_address: clientIp,
      user_agent: userAgent,
      signing_token_used: input.signing_token,
      agreement_checked: input.agreement_checked,
    });

    // STEP 5: Enqueue signed PDF generation (placeholder — async, doesn't block)
    // In production: await signedPdfQueue.add('generate-signed-pdf', { ... });

    // STEP 6: Update quote status → 'signed'
    await client.query(
      `UPDATE quotes_v2 SET status = 'signed' WHERE id = $1`,
      [quote.id],
    );

    // STEP 7: Update job status → 'unscheduled' (Work Order)
    await client.query(
      `UPDATE jobs SET status = 'unscheduled' WHERE id = $1`,
      [quote.job_id],
    );

    // STEP 8: Create job diary entry
    await diaryRepo.insert(client, {
      tenant_id: quote.tenant_id,
      job_id: quote.job_id,
      entry_type: 'quote_signed',
      title: `Quote signed by ${input.signer_name}`,
      metadata: {
        signer_name: input.signer_name,
        signed_at: new Date().toISOString(),
        quote_id: quote.id,
        quote_number: quote.quote_number,
      },
      is_system_entry: true,
    });

    await client.query('COMMIT');

    // STEP 9: Post-commit notifications (non-transactional)
    // In production: notify coordinator via event emitter

    return {
      success: true,
      signer_name: input.signer_name,
      message: `Thank you, ${input.signer_name.split(' ')[0]}. Your quote has been accepted. We will contact you shortly to schedule your service.`,
      quote_number: quote.quote_number,
      signed_at: new Date().toISOString(),
    };
  } catch (err) {
    // Only rollback if we haven't committed yet
    try {
      await client.query('ROLLBACK');
    } catch {
      // Already committed or already rolled back
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get signature details for staff (authenticated).
 */
export async function getSignatureDetails(
  tenantId: string,
  quoteId: string,
) {
  const signature = await repo.findByQuoteId(tenantId, quoteId);
  if (!signature) {
    throw new AppError(404, 'Signature not found');
  }
  return signature;
}
