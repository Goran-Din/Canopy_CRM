# Wave 2, Task 4: E-Signature Module (D-25)

> **Branch:** `feature/wave2-e-signature`
> **Source docs:** D-25 (E-Signature Module)
> **Dependencies:** Task 3 (Quote Builder), Task 2 (File Management), Task 1 (Job Pipeline — diary)
> **Build order:** After Quote Builder

---

## Overview

Public signing page (no login required). Client receives email/SMS with unique signing link. Signs on mobile or tablet via HTML5 Canvas. Signing auto-converts job to Work Order. Signature stored as immutable legal record. Signed PDF generated asynchronously.

## Files to Create

```
api/src/modules/signatures/
├── controller.ts
├── service.ts
├── repository.ts
├── schema.ts
├── routes.ts
├── signing-page.template.ts   ← HTML template for public signing page
└── __tests__/
```

---

## Part A: Signing Token Security

```typescript
// Token already generated in Quote Builder when quote is created:
// crypto.randomBytes(32).toString('hex') → 64-char hex, 256-bit entropy

// Public URL: https://app.sunsetapp.us/sign/{token}
// Quote ID NOT in URL — only token
// Token lookup: SELECT * FROM quotes_v2 WHERE signing_token = $1
```

### Token Validation Rules

| Condition | HTTP Status | Response |
|-----------|------------|----------|
| Token found, status='sent' or 'viewed' | 200 | Display quote for signing |
| Token found, status='signed' | 200 | Show "already signed" message |
| Token found, status='expired' | 401 | "This quote has expired" |
| Token found, status='superseded' | 401 | "A newer version has been sent" |
| Token not found | 401 | "Invalid or expired link" |
| valid_until date passed | 401 | Set status→'expired', return "expired" |
| Duplicate submission (same token) | 409 | "Already signed" |

---

## Part B: Repository

### `repository.ts`

```typescript
// Get quote by signing token (PUBLIC — no tenant_id required)
export async function findBySigningToken(token: string): Promise<QuoteV2 | null> {
  const result = await queryDb(
    `SELECT q.*, c.display_name as customer_name, c.email as customer_email,
            p.street_address, p.city, p.state, p.zip_code,
            json_agg(json_build_object(
              'id', qs.id, 'title', qs.title, 'body', qs.body, 'sort_order', qs.sort_order,
              'line_items', (
                SELECT json_agg(json_build_object(
                  'id', qli.id, 'item_name', qli.item_name, 'description', qli.description,
                  'quantity', qli.quantity, 'unit', qli.unit, 'unit_price', qli.unit_price,
                  'line_total', qli.line_total, 'is_taxable', qli.is_taxable
                ) ORDER BY qli.sort_order)
                FROM quote_line_items qli WHERE qli.section_id = qs.id
              )
            ) ORDER BY qs.sort_order) as sections
     FROM quotes_v2 q
     JOIN customers c ON q.customer_id = c.id
     JOIN properties p ON q.property_id = p.id
     LEFT JOIN quote_sections qs ON qs.quote_id = q.id
     WHERE q.signing_token = $1
     GROUP BY q.id, c.display_name, c.email, p.street_address, p.city, p.state, p.zip_code`,
    [token]
  );
  return result.rows[0] ?? null;
}

// Insert signature record (IMMUTABLE — no update, no delete)
export async function insertSignature(client: PoolClient, sig: SignatureInsert): Promise<QuoteSignature> {
  const result = await client.query(
    `INSERT INTO quote_signatures
     (tenant_id, quote_id, signer_name, signature_file_id, signed_at,
      signer_ip_address, user_agent, signing_token_used, agreement_checked)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [sig.tenant_id, sig.quote_id, sig.signer_name, sig.signature_file_id,
     sig.signed_at, sig.signer_ip_address, sig.user_agent,
     sig.signing_token_used, sig.agreement_checked]
  );
  return result.rows[0];
}

// Get signature by quote ID (staff only)
export async function findByQuoteId(tenantId: string, quoteId: string): Promise<QuoteSignature | null> {
  // WHERE tenant_id=$1 AND quote_id=$2
}
```

---

## Part C: Service Layer — Signature Submission Flow

### `service.ts`

**CRITICAL:** The entire signing flow happens in a SINGLE database transaction. If any step fails, the entire operation rolls back.

```typescript
export async function processSignature(
  token: string,
  signerName: string,
  signatureImageBase64: string,
  agreementChecked: boolean,
  clientIp: string,
  userAgent: string,
) {
  return await db.transaction(async (client) => {
    // STEP 1: Validate token & lock quote row
    const quote = await client.query(
      'SELECT * FROM quotes_v2 WHERE signing_token = $1 FOR UPDATE',
      [token]
    );
    if (!quote.rows[0]) throw new SigningError('INVALID_TOKEN', 401);

    const q = quote.rows[0];
    if (q.status === 'signed') throw new SigningError('ALREADY_SIGNED', 409);
    if (q.status === 'expired' || q.status === 'superseded') throw new SigningError('EXPIRED', 401);

    // Check valid_until
    if (new Date() > new Date(q.valid_until)) {
      await client.query('UPDATE quotes_v2 SET status=$1, updated_at=NOW() WHERE id=$2', ['expired', q.id]);
      throw new SigningError('EXPIRED', 401);
    }

    // STEP 2: Upload signature image to R2
    const sigR2Key = `${q.tenant_id}/clients/${q.customer_id}/signatures/${q.id}_sig.png`;
    const sigBuffer = Buffer.from(signatureImageBase64, 'base64');
    await r2Client.uploadBuffer(sigR2Key, sigBuffer, 'image/png');

    // STEP 3: Create client_files record for signature
    const sigFile = await FileRepository.insertFile(client, {
      tenant_id: q.tenant_id,
      customer_id: q.customer_id,
      r2_key: sigR2Key,
      file_name: `signature_${q.quote_number}.png`,
      file_category: 'signature',
      portal_visible: false,
      is_signed_document: false, // signature IMAGE is not the signed doc — the PDF is
      uploaded_by_client: true,
      upload_source: 'client_portal',
    });

    // STEP 4: Create quote_signatures record (immutable audit trail)
    await SignatureRepository.insertSignature(client, {
      tenant_id: q.tenant_id,
      quote_id: q.id,
      signer_name: signerName,
      signature_file_id: sigFile.id,
      signed_at: new Date(),
      signer_ip_address: clientIp,
      user_agent: userAgent,
      signing_token_used: token,
      agreement_checked: agreementChecked,
    });

    // STEP 5: Enqueue signed PDF generation (async — does NOT block transaction)
    await signedPdfQueue.add('generate-signed-pdf', {
      quote_id: q.id,
      signature_file_id: sigFile.id,
      tenant_id: q.tenant_id,
    });

    // STEP 6: Update quote status → 'signed'
    await client.query(
      'UPDATE quotes_v2 SET status=$1, updated_at=NOW() WHERE id=$2',
      ['signed', q.id]
    );

    // STEP 7: Update job status → 'unscheduled' (Work Order)
    await client.query(
      "UPDATE jobs SET status='unscheduled', updated_at=NOW() WHERE id=$1",
      [q.job_id]
    );

    // STEP 8: Create job diary entry
    await DiaryRepository.insert(client, {
      tenant_id: q.tenant_id,
      job_id: q.job_id,
      entry_type: 'quote_signed',
      title: `Quote signed by ${signerName}`,
      metadata: { signer_name: signerName, signed_at: new Date(), quote_id: q.id },
      is_system_entry: true,
    });

    // STEP 9: Notify coordinator (after commit, not in transaction)
    // This is done via event emitter or scheduled after transaction completes

    return { success: true, message: 'Quote signed successfully' };
  });

  // Post-commit: notify coordinator
  // await NotificationService.dispatch({ type: 'quote_signed', job_id: quote.job_id, ... });
}
```

---

## Part D: Signed PDF Generation (Worker)

Generated by Bull queue worker after signing transaction commits.

```typescript
// signed-pdf.worker.ts
export async function generateSignedPdf(job: { quote_id: string, signature_file_id: string, tenant_id: string }) {
  // 1. Load quote with all sections, items, customer, property
  // 2. Load signature image from R2
  // 3. Render HTML template with quote content + signature image
  //    - Includes: 'Signed on [date] at [time] UTC'
  //    - Includes: digital acceptance notice with IP and token prefix
  //    - Light diagonal 'SIGNED — [date]' watermark
  // 4. Generate PDF via Puppeteer
  // 5. Upload to R2: {tenant_id}/clients/{customer_id}/agreements/{year}/{uuid}_signed_v{version}.pdf
  // 6. Create client_files record:
  //    - file_category = 'contract_pdf'
  //    - is_signed_document = TRUE (IMMUTABLE — can never be deleted)
  //    - portal_visible = TRUE (client can download)
  //    - upload_source = 'system_generated'
  // 7. Update quotes_v2.signed_pdf_file_id (immutable once set)
}
```

**Immutability Rule:** Signed PDF file (`is_signed_document=TRUE`) can NEVER be soft-deleted or modified. Service layer returns 422 on delete attempt. `signed_pdf_file_id` once set is immutable — UPDATE blocked.

---

## Part E: Zod Schemas

### `schema.ts`

```typescript
// Public signing page — GET (validates token format)
export const signingTokenParamSchema = z.object({
  token: z.string().length(64).regex(/^[a-f0-9]+$/),
});

// Public signing — POST (signature submission)
export const submitSignatureSchema = z.object({
  signing_token: z.string().length(64).regex(/^[a-f0-9]+$/),
  signer_name: z.string().min(2).max(255).trim(),
  signature_image_base64: z.string().min(100), // Base64 PNG data (at least 1 stroke)
  agreement_checked: z.literal(true, { errorMap: () => ({ message: 'Agreement must be accepted' }) }),
});
```

---

## Part F: API Endpoints

### `routes.ts`

```typescript
// PUBLIC endpoints (no authentication)
router.get('/v1/quotes/sign/:token', rateLimitSigningGet, ctrl.getSigningPage);
router.post('/v1/quotes/sign', rateLimitSigningPost, validate(submitSignatureSchema), ctrl.submitSignature);

// STAFF endpoints (authenticated)
router.get('/v1/quotes/:id/signature', authenticate, tenantScope, ctrl.getSignatureDetails);
router.get('/v1/quotes/:id/signed-pdf', authenticate, tenantScope, ctrl.getSignedPdfUrl);
```

### Rate Limiting (Critical)

```typescript
// GET /v1/quotes/sign/:token — 10 requests per minute per IP
const rateLimitSigningGet = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
});

// POST /v1/quotes/sign — 3 attempts per token lifetime + 5 per minute per IP
const rateLimitSigningPost = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
});
// Additional: per-token attempt tracking in service layer (max 3 submissions per token)
```

---

## Part G: Confirmation Page Response

After successful signature submission, return data for the confirmation page:

```typescript
// Response to POST /v1/quotes/sign
{
  success: true,
  signer_name: "John Smith",
  message: "Thank you, John. Your quote has been accepted. We will contact you shortly to schedule your service.",
  quote_number: "Q-0047-26",
  signed_at: "2026-04-06T14:30:00Z"
}
```

---

## Business Rules (Non-Negotiable)

1. **Single transaction** — all 9 steps succeed or all roll back
2. **Signed quotes immutable** — no edits to sections, items, header after signing
3. **Signed PDF immutable** — is_signed_document=TRUE prevents deletion
4. **Rate limiting** — 10 GET/min, 3 POST attempts per token lifetime
5. **Job auto-converts** — status becomes 'unscheduled' (appears in Dispatch Queue)
6. **Diary entry** — 'quote_signed' logged in same transaction

---

## Testing

Write tests for:
1. Valid token returns quote summary
2. Expired/superseded/invalid tokens return correct errors
3. Signature submission creates all records atomically
4. Job status changes to 'unscheduled' after signing
5. Diary entry created in same transaction
6. Duplicate submission returns 409
7. Rate limiting enforcement
8. Signed PDF file marked as is_signed_document=TRUE

## Done When
- [ ] Public signing page endpoint returns quote data
- [ ] Signature submission flow (9 steps, single transaction)
- [ ] R2 upload of signature image
- [ ] Job auto-converts to Work Order
- [ ] Diary entry on signing
- [ ] Signed PDF generation queued
- [ ] Rate limiting on public endpoints
- [ ] All tests pass
- [ ] Committed to branch
