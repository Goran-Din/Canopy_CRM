import crypto from 'node:crypto';
import { AppError } from '../../middleware/errorHandler.js';
import * as repo from './repository.js';
import * as jobRepo from '../jobs/repository.js';
import * as diaryRepo from '../jobs/diary/diary.repository.js';
import * as templateRepo from '../templates/repository.js';
import * as pdfService from './pdf/quote-pdf.service.js';
import type { QuoteHtmlData } from './pdf/quote-html-template.js';
import type {
  CreateQuoteInput,
  UpdateQuoteInput,
  AddSectionInput,
  UpdateSectionInput,
  AddLineItemInput,
  UpdateLineItemInput,
  GeneratePdfInput,
  SendQuoteInput,
  SendQuoteV2Input,
  ResendQuoteInput,
  ConvertToInvoiceInput,
  LoadTemplateInput,
  SaveAsTemplateInput,
  DeclineQuoteInput,
} from './schema.js';

const IMMUTABLE_STATUSES = ['signed', 'converted', 'expired'];

function assertEditable(quote: repo.QuoteV2) {
  if (IMMUTABLE_STATUSES.includes(quote.status)) {
    throw new AppError(422, `Cannot edit a ${quote.status} quote`);
  }
}

// === Quotes ===

export async function createQuote(
  tenantId: string,
  jobId: string,
  input: CreateQuoteInput,
  userId: string,
) {
  // Validate job exists
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  // Check no active draft
  const existingDraft = await repo.findActiveByJobId(tenantId, jobId);
  if (existingDraft) {
    throw new AppError(409, 'Active draft already exists for this job');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const quoteNumber = await repo.getNextQuoteNumber(client, tenantId);
    const signingToken = crypto.randomBytes(32).toString('hex');

    const validUntil = input.valid_until
      ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

    const quote = await repo.insert(client, {
      tenant_id: tenantId,
      job_id: jobId,
      quote_number: quoteNumber,
      version: 1,
      status: 'draft',
      client_notes: input.client_notes,
      payment_terms: input.payment_terms,
      internal_notes: input.internal_notes,
      tax_rate: input.tax_rate,
      discount_amount: 0,
      valid_until: validUntil,
      signing_token: signingToken,
      created_by: userId,
    });

    // Diary entry
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: jobId,
      entry_type: 'quote_created',
      title: 'Quote draft created',
      metadata: { quote_id: quote.id, quote_number: quoteNumber },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
    return quote;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getQuote(tenantId: string, quoteId: string) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) {
    throw new AppError(404, 'Quote not found');
  }
  return quote;
}

export async function listQuoteVersions(tenantId: string, jobId: string) {
  return repo.findByJobId(tenantId, jobId);
}

export async function updateQuote(
  tenantId: string,
  quoteId: string,
  input: UpdateQuoteInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) {
    throw new AppError(404, 'Quote not found');
  }

  assertEditable(quote);

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    // If sent or viewed → create new version
    if (['sent', 'viewed'].includes(quote.status)) {
      await repo.updateStatus(client, quoteId, 'superseded');

      const signingToken = crypto.randomBytes(32).toString('hex');
      const newQuote = await repo.insert(client, {
        tenant_id: tenantId,
        job_id: quote.job_id,
        quote_number: quote.quote_number,
        version: quote.version + 1,
        status: 'draft',
        client_notes: input.client_notes ?? quote.client_notes,
        payment_terms: input.payment_terms ?? quote.payment_terms,
        internal_notes: input.internal_notes ?? quote.internal_notes,
        tax_rate: input.tax_rate ?? quote.tax_rate,
        discount_amount: input.discount_amount ?? quote.discount_amount,
        valid_until: input.valid_until ?? quote.valid_until,
        signing_token: signingToken,
        created_by: userId,
      });

      // Copy sections and items
      await repo.copyQuoteContent(client, quoteId, newQuote.id, tenantId);

      // Diary entry
      await diaryRepo.insert(client, {
        tenant_id: tenantId,
        job_id: quote.job_id,
        entry_type: 'quote_version_created',
        title: `Quote version ${newQuote.version} created`,
        metadata: { quote_id: newQuote.id, version: newQuote.version, from_quote_id: quoteId },
        created_by_user_id: userId,
        is_system_entry: true,
      });

      await client.query('COMMIT');
      return repo.getById(tenantId, newQuote.id);
    }

    // Draft → edit in place
    const updated = await repo.update(client, quoteId, {
      ...input,
      updated_by: userId,
    });

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Sections ===

export async function addSection(
  tenantId: string,
  quoteId: string,
  input: AddSectionInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) {
    throw new AppError(404, 'Quote not found');
  }
  assertEditable(quote);

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const section = await repo.insertSection(client, {
      tenant_id: tenantId,
      quote_id: quoteId,
      title: input.title,
      body: input.body,
      sort_order: input.sort_order,
    });

    await client.query('COMMIT');
    return section;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateSection(
  tenantId: string,
  quoteId: string,
  sectionId: string,
  input: UpdateSectionInput,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');
  assertEditable(quote);

  const section = await repo.getSectionById(tenantId, sectionId);
  if (!section || section.quote_id !== quoteId) {
    throw new AppError(404, 'Section not found');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const updated = await repo.updateSection(client, sectionId, input);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteSection(
  tenantId: string,
  quoteId: string,
  sectionId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');
  assertEditable(quote);

  const section = await repo.getSectionById(tenantId, sectionId);
  if (!section || section.quote_id !== quoteId) {
    throw new AppError(404, 'Section not found');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    await repo.deleteSection(client, sectionId);
    // Recalculate totals after section deleted (cascades line items)
    await recalculateTotals(client, tenantId, quoteId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Line Items ===

export async function addLineItem(
  tenantId: string,
  quoteId: string,
  sectionId: string,
  input: AddLineItemInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');
  assertEditable(quote);

  const section = await repo.getSectionById(tenantId, sectionId);
  if (!section || section.quote_id !== quoteId) {
    throw new AppError(404, 'Section not found');
  }

  // Compute line_total
  const lineTotal = input.quantity * input.unit_price;

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const item = await repo.insertLineItem(client, {
      tenant_id: tenantId,
      quote_id: quoteId,
      section_id: sectionId,
      xero_item_id: input.xero_item_id,
      item_name: input.item_name,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      unit_price: input.unit_price,
      line_total: lineTotal,
      is_taxable: input.is_taxable,
      sort_order: input.sort_order,
    });

    // Recalculate quote totals
    await recalculateTotals(client, tenantId, quoteId);

    await client.query('COMMIT');
    return item;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateLineItem(
  tenantId: string,
  quoteId: string,
  sectionId: string,
  itemId: string,
  input: UpdateLineItemInput,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');
  assertEditable(quote);

  const item = await repo.getLineItemById(tenantId, itemId);
  if (!item || item.section_id !== sectionId) {
    throw new AppError(404, 'Line item not found');
  }

  // Recompute line_total if quantity or unit_price changed
  const quantity = input.quantity ?? Number(item.quantity);
  const unitPrice = input.unit_price ?? Number(item.unit_price);
  const lineTotal = quantity * unitPrice;

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const updated = await repo.updateLineItem(client, itemId, {
      ...input,
      line_total: lineTotal,
    });

    await recalculateTotals(client, tenantId, quoteId);

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteLineItem(
  tenantId: string,
  quoteId: string,
  sectionId: string,
  itemId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');
  assertEditable(quote);

  const item = await repo.getLineItemById(tenantId, itemId);
  if (!item || item.section_id !== sectionId) {
    throw new AppError(404, 'Line item not found');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    await repo.deleteLineItem(client, itemId);
    await recalculateTotals(client, tenantId, quoteId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Totals ===

async function recalculateTotals(
  client: import('pg').PoolClient,
  tenantId: string,
  quoteId: string,
): Promise<repo.QuoteTotals> {
  const items = await repo.findLineItemsByQuoteId(tenantId, quoteId);

  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0);

  // Get quote for discount and tax settings
  const quoteResult = await client.query<repo.QuoteV2>(
    `SELECT * FROM quotes_v2 WHERE id = $1`,
    [quoteId],
  );
  const quote = quoteResult.rows[0];

  const discount = Number(quote.discount_amount ?? 0);
  const taxRate = Number(quote.tax_rate ?? 0);

  const taxableAmount = items
    .filter(item => item.is_taxable)
    .reduce((sum, item) => sum + Number(item.line_total), 0);

  const taxAmount = taxRate > 0 ? taxableAmount * taxRate : 0;
  const totalAmount = subtotal - discount + taxAmount;

  const totals: repo.QuoteTotals = {
    subtotal: Math.round(subtotal * 100) / 100,
    discount_amount: Math.round(discount * 100) / 100,
    taxable_amount: Math.round(taxableAmount * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    total_amount: Math.round(totalAmount * 100) / 100,
  };

  await repo.updateTotals(client, quoteId, totals);
  return totals;
}

// === PDF & Send ===

export async function generatePdf(
  tenantId: string,
  quoteId: string,
  input: GeneratePdfInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (!quote.sections?.length || !quote.sections.some(s => s.line_items?.length)) {
    throw new AppError(422, 'Quote must have at least one section with one line item');
  }

  // Build HTML data
  const htmlData: QuoteHtmlData = {
    quote_number: quote.quote_number,
    version: quote.version,
    created_at: String(quote.created_at),
    valid_until: quote.valid_until,
    customer_name: (quote as Record<string, unknown>).customer_display_name as string ?? '',
    property_address: (quote as Record<string, unknown>).property_name as string ?? '',
    sections: (quote.sections ?? []).map(s => ({
      section_title: s.section_title,
      section_body: s.section_body,
      line_items: (s.line_items ?? []).map(item => ({
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        line_total: item.line_total,
      })),
    })),
    subtotal: quote.subtotal,
    discount_amount: quote.discount_amount,
    tax_amount: quote.tax_amount,
    total_amount: quote.total_amount,
    client_notes: quote.client_notes,
    payment_terms: quote.payment_terms,
  };

  const pdfBuffer = await pdfService.generatePdfBuffer(htmlData);
  const customerId = (quote as Record<string, unknown>).customer_id as string ?? '';

  const { file_id } = await pdfService.uploadQuotePdf(
    tenantId, customerId, quote.quote_number, quote.version, pdfBuffer, false,
  );

  // Update quote with pdf_file_id
  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    await repo.update(client, quoteId, { pdf_file_id: file_id });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Auto-send if requested
  if (input.auto_send) {
    await sendQuote(tenantId, quoteId, {
      send_via: input.send_via,
    }, userId);
  }

  return {
    status: 'complete',
    pdf_file_id: file_id,
    quote_id: quoteId,
  };
}

export async function sendQuote(
  tenantId: string,
  quoteId: string,
  input: SendQuoteInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (!quote.pdf_file_id) {
    throw new AppError(400, 'PDF not yet generated');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    await repo.updateStatus(client, quoteId, 'sent');
    await repo.update(client, quoteId, {
      sent_at: new Date(),
      sent_via: input.send_via,
      sent_to_email: input.recipient_email,
      sent_to_phone: input.recipient_phone,
    });

    // Diary entry
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: quote.job_id,
      entry_type: 'quote_sent',
      title: `Quote sent via ${input.send_via}`,
      metadata: {
        quote_id: quoteId,
        send_via: input.send_via,
        recipient_email: input.recipient_email,
        recipient_phone: input.recipient_phone,
      },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
    return { status: 'sent', quote_id: quoteId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Xero Items ===

export async function searchXeroItems(tenantId: string, search: string) {
  return repo.searchXeroItems(tenantId, search);
}

// === V2 Send/Resend ===

export async function sendQuoteV2(
  tenantId: string,
  quoteId: string,
  input: SendQuoteV2Input,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (!quote.sections?.length || !quote.sections.some(s => s.line_items?.length)) {
    throw new AppError(422, 'Quote must have at least one line item to send');
  }

  // Generate PDF if not already done
  if (!quote.pdf_file_id) {
    await generatePdf(tenantId, quoteId, { auto_send: false, send_via: input.channel }, userId);
  }

  const signingToken = crypto.randomBytes(32).toString('hex');

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    await repo.updateStatus(client, quoteId, 'sent');
    await repo.update(client, quoteId, {
      signing_token: signingToken,
      sent_via: input.channel,
      sent_at: new Date(),
      sent_to_email: input.email ?? null,
      sent_to_phone: input.phone ?? null,
    });

    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: quote.job_id,
      entry_type: 'quote_sent',
      title: `Quote ${quote.quote_number} sent to ${input.email ?? input.phone ?? 'client'} via ${input.channel}`,
      metadata: { quote_id: quoteId, channel: input.channel },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const signingUrl = `https://app.sunsetapp.us/sign/${signingToken}`;

  return {
    status: 'sent',
    sent_at: new Date().toISOString(),
    signing_token: signingToken,
    signing_url: signingUrl,
    sent_to_email: input.email ?? null,
    sent_to_phone: input.phone ?? null,
  };
}

export async function resendQuote(
  tenantId: string,
  quoteId: string,
  input: ResendQuoteInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (quote.status !== 'sent' && quote.status !== 'viewed') {
    throw new AppError(422, `Cannot resend a ${quote.status} quote — only sent or viewed quotes can be resent`);
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: quote.job_id,
      entry_type: 'quote_resent',
      title: `Quote ${quote.quote_number} resent to ${input.email ?? 'client'}`,
      metadata: { quote_id: quoteId },
      created_by_user_id: userId,
      is_system_entry: false,
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    resent_at: new Date().toISOString(),
    sent_to_email: input.email ?? quote.sent_to_email,
    sent_to_phone: input.phone ?? quote.sent_to_phone,
  };
}

// === Signed PDF ===

export async function getSignedPdf(tenantId: string, quoteId: string) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (quote.status !== 'signed' && quote.status !== 'converted') {
    throw new AppError(422, 'Quote is not signed');
  }

  if (!(quote as Record<string, unknown>).signed_pdf_file_id) {
    throw new AppError(404, 'Signed PDF not yet generated');
  }

  return {
    signed_pdf_file_id: (quote as Record<string, unknown>).signed_pdf_file_id,
    download_url: `/v1/files/${(quote as Record<string, unknown>).signed_pdf_file_id}/download`,
    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
  };
}

// === Quote to Invoice ===

export async function convertToInvoice(
  tenantId: string,
  quoteId: string,
  input: ConvertToInvoiceInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (quote.status !== 'signed') {
    throw new AppError(422, 'Only signed quotes can be converted to invoices');
  }

  // Check not already converted
  if ((quote as Record<string, unknown>).converted_invoice_id) {
    throw new AppError(409, 'An invoice has already been created from this quote');
  }

  // Build line items from quote, applying adjustments
  let lineItems = (quote.sections ?? []).flatMap(s =>
    (s.line_items ?? []).map(item => ({
      id: item.id,
      item_name: item.item_name,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
      is_taxable: item.is_taxable,
      xero_item_code: item.xero_item_code,
    })),
  );

  if (input.adjustments) {
    for (const adj of input.adjustments) {
      if (adj.remove) {
        lineItems = lineItems.filter(i => i.id !== adj.line_item_id);
        continue;
      }
      const item = lineItems.find(i => i.id === adj.line_item_id);
      if (item) {
        if (adj.quantity != null) item.quantity = adj.quantity;
        if (adj.unit_price != null) item.unit_price = adj.unit_price;
        item.line_total = item.quantity * item.unit_price;
      }
    }
  }

  const totalAmount = lineItems.reduce((sum, i) => sum + i.line_total, 0);
  const dueDate = new Date(Date.now() + input.due_days * 24 * 60 * 60 * 1000);

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    // Create invoice draft
    const invoiceResult = await client.query<{ id: string; invoice_number: string }>(
      `INSERT INTO invoices
       (tenant_id, customer_id, property_id, job_id,
        status, total_amount, due_date, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7)
       RETURNING id, invoice_number`,
      [
        tenantId,
        (quote as Record<string, unknown>).customer_id ??
          (await client.query(`SELECT customer_id FROM jobs WHERE id = $1`, [quote.job_id])).rows[0]?.customer_id,
        (quote as Record<string, unknown>).property_id ??
          (await client.query(`SELECT property_id FROM jobs WHERE id = $1`, [quote.job_id])).rows[0]?.property_id,
        quote.job_id,
        totalAmount,
        dueDate,
        userId,
      ],
    );

    const invoice = invoiceResult.rows[0];

    // Update quote status to converted
    await repo.updateStatus(client, quoteId, 'converted');

    // Diary entry
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: quote.job_id,
      entry_type: 'invoice_from_quote',
      title: `Invoice ${invoice.invoice_number ?? invoice.id} created from quote ${quote.quote_number}`,
      metadata: { invoice_id: invoice.id, quote_id: quoteId },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');

    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number ?? null,
      status: 'draft',
      total_amount: totalAmount,
      line_items: lineItems,
      due_date: dueDate.toISOString().split('T')[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Template Integration ===

export async function loadTemplate(
  tenantId: string,
  quoteId: string,
  input: LoadTemplateInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');
  assertEditable(quote);

  const template = await templateRepo.findById(input.template_id, tenantId);
  if (!template) throw new AppError(404, 'Template not found');
  if (template.template_category !== 'quote') {
    throw new AppError(400, 'Only quote templates can be loaded');
  }

  const content = template.content as {
    sections?: Array<{
      section_title: string;
      section_body?: string;
      sort_order?: number;
      line_items?: Array<{
        item_name: string;
        description?: string;
        xero_item_code?: string;
        unit?: string;
        sort_order?: number;
      }>;
    }>;
  };

  if (!content.sections?.length) {
    throw new AppError(400, 'Template has no sections');
  }

  const existingSections = quote.sections ?? [];
  let sectionSort = existingSections.length;

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    for (const tplSection of content.sections) {
      const section = await repo.insertSection(client, {
        tenant_id: tenantId,
        quote_id: quoteId,
        title: tplSection.section_title,
        body: tplSection.section_body ?? null,
        sort_order: tplSection.sort_order ?? sectionSort,
      });
      sectionSort++;

      if (tplSection.line_items?.length) {
        let itemSort = 0;
        for (const tplItem of tplSection.line_items) {
          await repo.insertLineItem(client, {
            tenant_id: tenantId,
            quote_id: quoteId,
            section_id: section.id,
            item_name: tplItem.item_name,
            description: tplItem.description ?? null,
            quantity: null,
            unit: tplItem.unit ?? null,
            unit_price: null,
            line_total: 0,
            is_taxable: false,
            sort_order: tplItem.sort_order ?? itemSort,
          });
          itemSort++;
        }
      }
    }

    await client.query('COMMIT');
    return repo.getById(tenantId, quoteId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function saveAsTemplate(
  tenantId: string,
  quoteId: string,
  input: SaveAsTemplateInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  const sections = (quote.sections ?? []).map(s => ({
    section_title: s.section_title,
    section_body: s.section_body,
    sort_order: s.sort_order,
    line_items: (s.line_items ?? []).map(item => ({
      item_name: item.item_name,
      description: item.description,
      xero_item_code: item.xero_item_code ?? null,
      quantity: null,
      unit_price: null,
      unit: item.unit,
      sort_order: item.sort_order,
    })),
  }));

  const template = await templateRepo.create({
    tenant_id: tenantId,
    template_category: 'quote',
    template_name: input.template_name,
    content: { sections },
    tags: input.tags ?? [],
    created_by: userId,
  });

  return { template_id: template.id, template_name: template.template_name };
}

// === Decline Quote ===

export async function declineQuote(
  tenantId: string,
  quoteId: string,
  input: DeclineQuoteInput,
  userId: string,
) {
  const quote = await repo.getById(tenantId, quoteId);
  if (!quote) throw new AppError(404, 'Quote not found');

  if (quote.status !== 'sent' && quote.status !== 'viewed') {
    throw new AppError(422, `Cannot decline a ${quote.status} quote — only sent or viewed quotes can be declined`);
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE quotes_v2 SET status = 'declined', decline_reason = $1, declined_at = NOW(), declined_by = $2
       WHERE id = $3`,
      [input.decline_reason ?? null, userId, quoteId],
    );

    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: quote.job_id,
      entry_type: 'quote_declined',
      title: `Quote ${quote.quote_number} declined${input.decline_reason ? ` — ${input.decline_reason}` : ''}`,
      metadata: { quote_id: quoteId, decline_reason: input.decline_reason },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Trigger Mautic push (non-blocking)
  import('../integrations/mautic/mautic-service.js').then(({ pushDeclinedQuote }) => {
    pushDeclinedQuote(tenantId, quoteId).catch(() => {});
  }).catch(() => {});

  return repo.getById(tenantId, quoteId);
}
