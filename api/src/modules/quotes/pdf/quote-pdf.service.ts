import { logger } from '../../../config/logger.js';
import { buildQuoteHtml } from './quote-html-template.js';
import type { QuoteHtmlData } from './quote-html-template.js';

/**
 * Generate a quote PDF using Puppeteer.
 * Returns a Buffer containing the PDF.
 */
export async function generatePdfBuffer(data: QuoteHtmlData): Promise<Buffer> {
  const html = buildQuoteHtml(data);

  // Dynamic import to avoid loading Puppeteer when not needed (e.g., in tests)
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfUint8 = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}

/**
 * Generate a signed quote PDF with ACCEPTED badge and signature.
 */
export async function generateSignedPdfBuffer(
  data: QuoteHtmlData,
  signature: { signer_name: string; signed_at: string; signer_ip: string; signature_base64?: string },
): Promise<Buffer> {
  return generatePdfBuffer({
    ...data,
    is_signed: true,
    signer_name: signature.signer_name,
    signed_at: signature.signed_at,
    signer_ip: signature.signer_ip,
    signature_base64: signature.signature_base64,
  });
}

/**
 * Upload PDF buffer to R2 and create file record.
 * Returns file_id and download URL placeholder.
 */
export async function uploadQuotePdf(
  tenantId: string,
  customerId: string,
  quoteNumber: string,
  version: number,
  pdfBuffer: Buffer,
  isSigned: boolean,
): Promise<{ file_id: string; r2_key: string }> {
  const suffix = isSigned ? '-SIGNED' : '';
  const fileName = `Quote-${quoteNumber}-v${version}${suffix}.pdf`;
  const folder = isSigned ? 'quotes/signed' : 'quotes/pdf';
  const r2Key = `${tenantId}/clients/${customerId}/${folder}/${fileName}`;

  try {
    const { uploadBuffer } = await import('../../files/r2.client.js');
    await uploadBuffer(r2Key, pdfBuffer, 'application/pdf');

    const { queryDb } = await import('../../../config/database.js');
    const result = await queryDb<{ id: string }>(
      `INSERT INTO client_files
       (tenant_id, customer_id, r2_key, file_name, file_size_bytes,
        mime_type, file_category, portal_visible, upload_source)
       VALUES ($1, $2, $3, $4, $5, 'application/pdf', 'quote_pdf', FALSE, 'system')
       RETURNING id`,
      [tenantId, customerId, r2Key, fileName, pdfBuffer.length],
    );

    return { file_id: result.rows[0].id, r2_key: r2Key };
  } catch (err) {
    logger.error('Failed to upload quote PDF', { error: (err as Error).message });
    throw err;
  }
}
