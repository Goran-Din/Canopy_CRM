# Wave 2, Task 3: Quote Builder Module (D-24)

> **Branch:** `feature/wave2-quote-builder`
> **Source docs:** D-24 (Quote Builder Module)
> **Dependencies:** Task 1 (Job Pipeline — diary logging), Task 2 (File Management — PDF storage)
> **Build order:** After Job Pipeline and File Management

---

## Overview

Coordinators build, send, and manage quotes directly inside the CRM. Section-based structure with line items. Xero item search for reference only — prices always entered manually. PDF generation via Puppeteer queue. Quote versioning (new version on edit to sent/viewed). Templates for common services.

## Files to Create

```
api/src/modules/quotes/
├── controller.ts
├── service.ts
├── repository.ts
├── schema.ts
├── routes.ts
├── pdf/
│   ├── quote-pdf.worker.ts     ← Bull queue worker for PDF generation
│   └── quote-pdf.template.ts   ← HTML template for Puppeteer
└── __tests__/
```

---

## Part A: Repository

### `repository.ts`

```typescript
// === quotes_v2 ===

export async function insert(client: PoolClient, quote: QuoteInsert): Promise<QuoteV2> {
  // INSERT INTO quotes_v2 (tenant_id, job_id, customer_id, property_id, quote_number,
  //   version, status, valid_until, client_notes, payment_terms, internal_notes,
  //   tax_enabled, tax_rate, discount_amount, signing_token)
  // RETURNING *
  // signing_token = crypto.randomBytes(32).toString('hex')
}

export async function getById(tenantId: string, quoteId: string): Promise<QuoteV2 | null> {
  // SELECT q.*, json_agg(sections + items) as sections
  // JOIN quote_sections, quote_line_items
  // WHERE q.id=$1 AND q.tenant_id=$2
}

export async function findByJobId(tenantId: string, jobId: string): Promise<QuoteV2[]> {
  // All versions for a job, ordered by version DESC
}

export async function updateStatus(client: PoolClient, quoteId: string, status: string): Promise<void> {
  // UPDATE quotes_v2 SET status=$1, updated_at=NOW() WHERE id=$2
}

// === quote_sections ===

export async function insertSection(client: PoolClient, section: SectionInsert): Promise<QuoteSection> {
  // INSERT INTO quote_sections (tenant_id, quote_id, title, body, sort_order)
}

export async function updateSection(client: PoolClient, sectionId: string, updates: Partial<QuoteSection>): Promise<QuoteSection> {
  // UPDATE quote_sections SET ... WHERE id=$1
}

export async function deleteSection(client: PoolClient, sectionId: string): Promise<void> {
  // DELETE FROM quote_sections WHERE id=$1
  // CASCADE deletes line items
}

// === quote_line_items ===

export async function insertLineItem(client: PoolClient, item: LineItemInsert): Promise<QuoteLineItem> {
  // INSERT INTO quote_line_items (tenant_id, section_id, xero_item_id, item_name,
  //   description, quantity, unit, unit_price, line_total, is_taxable, sort_order)
  // line_total = quantity * unit_price (computed in service layer, stored)
}

export async function updateLineItem(client: PoolClient, itemId: string, updates: Partial<QuoteLineItem>): Promise<QuoteLineItem> {
  // UPDATE ... RETURNING *
}

export async function deleteLineItem(client: PoolClient, itemId: string): Promise<void> {
  // DELETE FROM quote_line_items WHERE id=$1
}
```

---

## Part B: Service Layer

### `service.ts`

```typescript
// Create new quote for a job
export async function createQuote(tenantId: string, jobId: string, input: CreateQuoteInput, userId: string) {
  return await db.transaction(async (client) => {
    // 1. Validate job exists and belongs to tenant
    const job = await JobsRepository.getById(client, jobId, tenantId);
    if (!job) throw new NotFoundError('Job not found');

    // 2. Check if active draft exists (only one active draft per job)
    const existingDraft = await QuoteRepository.findActiveByJobId(tenantId, jobId);
    if (existingDraft) throw new ConflictError('Active draft already exists for this job');

    // 3. Generate quote number (format: Q-NNNN-YY)
    const quoteNumber = await generateQuoteNumber(client, tenantId);

    // 4. Create quote
    const quote = await QuoteRepository.insert(client, {
      tenant_id: tenantId,
      job_id: jobId,
      customer_id: job.customer_id,
      property_id: job.property_id,
      quote_number: quoteNumber,
      version: 1,
      status: 'draft',
      valid_until: input.valid_until ?? addDays(new Date(), 30),
      client_notes: input.client_notes,
      payment_terms: input.payment_terms,
      internal_notes: input.internal_notes,
      tax_enabled: input.tax_enabled ?? false,
      tax_rate: input.tax_rate ?? 0,
      signing_token: crypto.randomBytes(32).toString('hex'),
      created_by: userId,
    });

    // 5. Diary entry
    await DiaryRepository.insert(client, {
      tenant_id: tenantId,
      job_id: jobId,
      entry_type: 'quote_created',
      title: 'Quote draft created',
      metadata: { quote_id: quote.id, quote_number: quoteNumber },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    return quote;
  });
}

// Update quote (creates new version if sent/viewed)
export async function updateQuote(tenantId: string, quoteId: string, input: UpdateQuoteInput, userId: string) {
  return await db.transaction(async (client) => {
    const quote = await QuoteRepository.getById(tenantId, quoteId);
    if (!quote) throw new NotFoundError('Quote not found');

    // IMMUTABILITY CHECK
    if (['signed', 'converted', 'expired'].includes(quote.status)) {
      throw new UnprocessableError('Cannot edit a signed, converted, or expired quote');
    }

    // If sent or viewed → create new version (old becomes 'superseded')
    if (['sent', 'viewed'].includes(quote.status)) {
      await QuoteRepository.updateStatus(client, quoteId, 'superseded');
      // Create new version with incremented version number
      const newQuote = await QuoteRepository.insert(client, {
        ...quote,
        id: undefined, // new UUID
        version: quote.version + 1,
        status: 'draft',
        signing_token: crypto.randomBytes(32).toString('hex'),
        // Copy all sections and items to new version
      });
      // Copy sections + items
      await copyQuoteContent(client, quoteId, newQuote.id);
      // Apply updates to new version
      return await applyUpdates(client, newQuote.id, input);
    }

    // Draft → edit in place
    return await applyUpdates(client, quoteId, input);
  });
}

// Recalculate totals (called after any line item change)
export async function recalculateTotals(client: PoolClient, quoteId: string): Promise<QuoteTotals> {
  const items = await QuoteRepository.findLineItemsByQuoteId(quoteId);

  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  const quote = await QuoteRepository.getById(/* ... */);
  const discount = Number(quote.discount_amount ?? 0);
  const taxableAmount = items
    .filter(item => item.is_taxable)
    .reduce((sum, item) => sum + Number(item.line_total), 0);
  const taxAmount = quote.tax_enabled ? taxableAmount * Number(quote.tax_rate) : 0;
  const total = subtotal - discount + taxAmount;

  await QuoteRepository.updateTotals(client, quoteId, {
    subtotal, discount_amount: discount, taxable_amount: taxableAmount,
    tax_amount: taxAmount, total_amount: total,
  });

  return { subtotal, discount, taxable_amount: taxableAmount, tax_amount: taxAmount, total };
}

// Generate PDF and optionally send
export async function generatePdfAndSend(tenantId: string, quoteId: string, autoSend: boolean, sendVia: string, userId: string) {
  const quote = await QuoteRepository.getById(tenantId, quoteId);
  if (!quote) throw new NotFoundError('Quote not found');

  // Validate: at least 1 section with 1 line item
  if (!quote.sections?.length || !quote.sections.some(s => s.line_items?.length)) {
    throw new BadRequestError('Quote must have at least one section with one line item');
  }

  // Enqueue PDF job (non-blocking)
  await pdfQueue.add('generate-quote-pdf', {
    quote_id: quoteId,
    tenant_id: tenantId,
    auto_send: autoSend,
    send_via: sendVia, // 'email' | 'sms' | 'both'
    user_id: userId,
  });

  // Return 202 — PDF generation is async
  return { status: 'queued', message: 'PDF generation started' };
}

// Send quote to client
export async function sendQuote(tenantId: string, quoteId: string, sendVia: string, userId: string) {
  return await db.transaction(async (client) => {
    const quote = await QuoteRepository.getById(tenantId, quoteId);
    if (!quote) throw new NotFoundError('Quote not found');
    if (!quote.pdf_file_id) throw new BadRequestError('PDF not yet generated');

    // Update status → sent
    await QuoteRepository.updateStatus(client, quoteId, 'sent');
    await QuoteRepository.update(client, quoteId, { sent_at: new Date(), sent_via: sendVia });

    // Send email/SMS via Resend
    if (sendVia === 'email' || sendVia === 'both') {
      // Send email with PDF attachment + signing link
    }
    if (sendVia === 'sms' || sendVia === 'both') {
      // Send SMS with signing link
    }

    // Diary entry
    await DiaryRepository.insert(client, {
      tenant_id: tenantId,
      job_id: quote.job_id,
      entry_type: 'quote_sent',
      title: `Quote sent to ${quote.customer_email} via ${sendVia}`,
      created_by_user_id: userId,
      is_system_entry: false,
    });
  });
}
```

---

## Part C: Xero Item Search

```typescript
// In controller or separate xero-items module
export async function searchXeroItems(tenantId: string, search: string): Promise<XeroItem[]> {
  return await queryDb(
    `SELECT id, item_code, item_name, sales_description, sales_account_code, unit_price
     FROM xero_items
     WHERE tenant_id = $1
       AND is_active = TRUE
       AND is_sold = TRUE
       AND (item_code ILIKE $2 OR item_name ILIKE $2 OR sales_description ILIKE $2)
     ORDER BY CASE WHEN item_code ILIKE $3 THEN 0 ELSE 1 END, item_code ASC
     LIMIT 10`,
    [tenantId, `%${search}%`, `${search}%`]
  );
  // Returns items with unit_price as REFERENCE ONLY
  // Frontend shows: "Xero default: $35.00" hint
  // Price field stays EMPTY for manual entry — NEVER auto-filled
}
```

**NON-NEGOTIABLE:** `unit_price` from Xero is displayed as a hint only. The quote line item `unit_price` must always be entered manually by the coordinator.

---

## Part D: Zod Schemas

### `schema.ts`

```typescript
export const createQuoteSchema = z.object({
  valid_until: z.coerce.date().optional(),
  client_notes: z.string().max(5000).optional(),
  payment_terms: z.string().max(2000).optional(),
  internal_notes: z.string().max(5000).optional(),
  tax_enabled: z.boolean().default(false),
  tax_rate: z.coerce.number().min(0).max(1).default(0), // 0.13 = 13%
});

export const updateQuoteSchema = z.object({
  client_notes: z.string().max(5000).optional(),
  payment_terms: z.string().max(2000).optional(),
  internal_notes: z.string().max(5000).optional(),
  valid_until: z.coerce.date().optional(),
  tax_enabled: z.boolean().optional(),
  tax_rate: z.coerce.number().min(0).max(1).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
});

export const addSectionSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().max(5000).optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const addLineItemSchema = z.object({
  xero_item_id: z.string().uuid().optional(), // Optional Xero reference
  item_name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().max(50).default('each'),
  unit_price: z.coerce.number().min(0), // ALWAYS manually entered
  is_taxable: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export const generatePdfSchema = z.object({
  auto_send: z.boolean().default(false),
  send_via: z.enum(['email', 'sms', 'both']).default('email'),
});

export const sendQuoteSchema = z.object({
  send_via: z.enum(['email', 'sms', 'both']),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().optional(),
});

export const xeroItemSearchSchema = z.object({
  search: z.string().min(1).max(100),
});
```

---

## Part E: API Endpoints

### `routes.ts`

```typescript
// Quotes
router.post('/v1/jobs/:jobId/quotes', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(createQuoteSchema), ctrl.createQuote);
router.get('/v1/jobs/:jobId/quotes', authenticate, tenantScope, ctrl.listQuoteVersions);
router.get('/v1/quotes/:id', authenticate, tenantScope, ctrl.getQuote);
router.patch('/v1/quotes/:id', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(updateQuoteSchema), ctrl.updateQuote);

// Sections
router.post('/v1/quotes/:id/sections', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(addSectionSchema), ctrl.addSection);
router.patch('/v1/quotes/:quoteId/sections/:sectionId', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.updateSection);
router.delete('/v1/quotes/:quoteId/sections/:sectionId', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.deleteSection);

// Line Items
router.post('/v1/quotes/:quoteId/sections/:sectionId/items', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(addLineItemSchema), ctrl.addLineItem);
router.patch('/v1/quotes/:quoteId/sections/:sectionId/items/:itemId', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.updateLineItem);
router.delete('/v1/quotes/:quoteId/sections/:sectionId/items/:itemId', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.deleteLineItem);

// PDF & Send
router.post('/v1/quotes/:id/generate-pdf', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(generatePdfSchema), ctrl.generatePdf);
router.post('/v1/quotes/:id/send', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(sendQuoteSchema), ctrl.sendQuote);
router.post('/v1/quotes/:id/resend', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.resendQuote);

// Xero Items
router.get('/v1/xero-items', authenticate, tenantScope, ctrl.searchXeroItems);
router.post('/v1/xero-items/sync', authenticate, tenantScope, requireRole('owner'), ctrl.syncXeroItems);

// Quote to Invoice
router.post('/v1/quotes/:id/convert-to-invoice', authenticate, tenantScope, requireRole('owner'), ctrl.convertToInvoice);
```

---

## Business Rules (Non-Negotiable)

1. **unit_price ALWAYS manual** — never auto-filled from Xero
2. **Signed quotes immutable** — no edits after signing
3. **Versioning** — editing sent/viewed quote creates new version; old → superseded
4. **Draft edits** — in-place (no new version)
5. **PDF generation async** — POST returns 202, frontend polls until pdf_file_id set
6. **Templates** — no prices or quantities (structure only)
7. **line_total** = quantity × unit_price (computed in service, stored in DB)
8. **All totals** recalculated on any line item change

---

## Testing

Write tests for:
1. Quote creation with diary entry
2. Section and line item CRUD
3. Total recalculation accuracy
4. Version creation on sent/viewed quote edit
5. Immutability of signed quotes (returns error)
6. Xero item search (returns results, does NOT auto-fill price)
7. PDF generation enqueued (returns 202)
8. Quote send with diary entry

## Done When
- [ ] Full quote CRUD (create, sections, items, totals)
- [ ] Versioning (new version on sent/viewed edit)
- [ ] Immutability (signed quotes locked)
- [ ] PDF generation queue
- [ ] Send flow (email/SMS) with diary entry
- [ ] Xero item search (reference only)
- [ ] All tests pass
- [ ] Committed to branch
