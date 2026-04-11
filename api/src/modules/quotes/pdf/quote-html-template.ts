export interface QuoteHtmlData {
  quote_number: string;
  version: number;
  created_at: string;
  valid_until: string | null;
  customer_name: string;
  property_address: string;
  sections: Array<{
    section_title: string;
    section_body: string | null;
    line_items: Array<{
      item_name: string;
      description: string | null;
      quantity: string;
      unit: string | null;
      unit_price: string;
      line_total: string;
    }>;
  }>;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  client_notes: string | null;
  payment_terms: string | null;
  is_signed?: boolean;
  signer_name?: string;
  signed_at?: string;
  signer_ip?: string;
  signature_base64?: string;
}

const ACCENT = '#2E7D32';

export function buildQuoteHtml(data: QuoteHtmlData): string {
  const sectionsHtml = data.sections.map(section => `
    <div class="section">
      <h3>${esc(section.section_title)}</h3>
      ${section.section_body ? `<p class="section-body">${esc(section.section_body)}</p>` : ''}
      <table>
        <thead>
          <tr>
            <th style="width:25%">Item</th>
            <th style="width:30%">Description</th>
            <th style="width:10%;text-align:right">Qty</th>
            <th style="width:10%">Unit</th>
            <th style="width:12%;text-align:right">Price</th>
            <th style="width:13%;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${section.line_items.map(item => `
            <tr>
              <td>${esc(item.item_name)}</td>
              <td>${esc(item.description ?? '')}</td>
              <td style="text-align:right">${item.quantity}</td>
              <td>${esc(item.unit ?? '')}</td>
              <td style="text-align:right">$${Number(item.unit_price).toFixed(2)}</td>
              <td style="text-align:right">$${Number(item.line_total).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  const signedBadge = data.is_signed ? `
    <div style="position:absolute;top:20px;right:20px;background:${ACCENT};color:white;padding:8px 20px;border-radius:4px;font-size:18px;font-weight:bold">
      ACCEPTED
    </div>
  ` : '';

  const signatureSection = data.is_signed ? `
    <div class="signature-section">
      <h3>Acceptance</h3>
      <p>I, ${esc(data.signer_name ?? '')}, accept this quote and authorize Sunset Services to proceed.</p>
      ${data.signature_base64 ? `<img src="data:image/png;base64,${data.signature_base64}" style="max-width:300px;max-height:100px;border-bottom:1px solid #333" />` : ''}
      <div class="sig-details">
        <p><strong>Signed by:</strong> ${esc(data.signer_name ?? '')}</p>
        <p><strong>Date:</strong> ${data.signed_at ? new Date(data.signed_at).toLocaleDateString('en-US') : ''}</p>
        <p style="font-size:10px;color:#888">IP: ${data.signer_ip ?? ''}</p>
      </div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; padding: 40px; position: relative; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid ${ACCENT}; padding-bottom: 15px; }
    .company h1 { color: ${ACCENT}; font-size: 24px; margin-bottom: 4px; }
    .company p { font-size: 11px; color: #666; }
    .quote-info { text-align: right; }
    .quote-info h2 { color: ${ACCENT}; font-size: 18px; }
    .quote-info p { font-size: 11px; color: #666; margin-top: 2px; }
    .customer-box { background: #f5f5f5; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
    .customer-box h4 { color: ${ACCENT}; margin-bottom: 4px; }
    .section { margin-bottom: 20px; }
    .section h3 { color: ${ACCENT}; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .section-body { color: #555; margin-bottom: 8px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #f5f5f5; padding: 6px 8px; text-align: left; font-size: 11px; border-bottom: 2px solid #ddd; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
    .totals { margin-left: auto; width: 260px; margin-top: 10px; }
    .totals tr td { padding: 4px 8px; }
    .totals .total-row { font-weight: bold; font-size: 14px; border-top: 2px solid ${ACCENT}; }
    .notes { margin-top: 20px; padding: 12px; background: #fafafa; border-left: 3px solid ${ACCENT}; font-size: 11px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
    .signature-section { margin-top: 30px; border-top: 2px solid ${ACCENT}; padding-top: 15px; }
    .sig-details p { margin: 2px 0; font-size: 11px; }
  </style>
</head>
<body>
  ${signedBadge}
  <div class="header">
    <div class="company">
      <h1>Sunset Services</h1>
      <p>Professional Landscape & Property Maintenance</p>
      <p>Phone: (555) 123-4567 | Email: info@sunsetservices.com</p>
    </div>
    <div class="quote-info">
      <h2>QUOTE</h2>
      <p><strong>${esc(data.quote_number)}</strong> (v${data.version})</p>
      <p>Date: ${new Date(data.created_at).toLocaleDateString('en-US')}</p>
      ${data.valid_until ? `<p>Valid until: ${new Date(data.valid_until).toLocaleDateString('en-US')}</p>` : ''}
    </div>
  </div>

  <div class="customer-box">
    <h4>Prepared for</h4>
    <p><strong>${esc(data.customer_name)}</strong></p>
    <p>${esc(data.property_address)}</p>
  </div>

  ${sectionsHtml}

  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">$${Number(data.subtotal).toFixed(2)}</td></tr>
    ${Number(data.discount_amount) > 0 ? `<tr><td>Discount</td><td style="text-align:right">-$${Number(data.discount_amount).toFixed(2)}</td></tr>` : ''}
    ${Number(data.tax_amount) > 0 ? `<tr><td>Tax</td><td style="text-align:right">$${Number(data.tax_amount).toFixed(2)}</td></tr>` : ''}
    <tr class="total-row"><td>Total</td><td style="text-align:right">$${Number(data.total_amount).toFixed(2)}</td></tr>
  </table>

  ${data.client_notes ? `<div class="notes"><strong>Notes:</strong><br>${esc(data.client_notes)}</div>` : ''}
  ${data.payment_terms ? `<div class="notes" style="margin-top:8px"><strong>Payment Terms:</strong><br>${esc(data.payment_terms)}</div>` : ''}

  ${signatureSection}

  <div class="footer">
    ${data.valid_until ? `This quote is valid until ${new Date(data.valid_until).toLocaleDateString('en-US')}.` : ''}
    Sunset Services | North 37 LLC
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
