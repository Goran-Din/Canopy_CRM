# Wave 2, Task 6: Billing Engine Module (D-29)

> **Branch:** `feature/wave2-billing-engine`
> **Source docs:** D-29 (Billing Engine Module), D-30 (Hardscape Milestone Billing)
> **Dependencies:** Task 5 (Service Occurrences), Wave 1 migrations 031-032
> **Build order:** After Service Occurrences (depends on occurrence data for Bronze billing)

---

## Overview

Automate invoice draft generation for all recurring contract types. **Drafts only — no invoice ever pushed to Xero automatically.** Every draft requires human review and approval before Xero push. Includes billing schedule pre-generation, nightly draft cron, approval workflow, and hardscape milestone billing.

## Files to Create

```
api/src/modules/billing/
├── controller.ts
├── service.ts
├── repository.ts
├── schema.ts
├── routes.ts
├── cron/
│   └── monthly-draft-generation.ts   ← node-cron job for 1st-of-month drafts
└── __tests__/
```

---

## Part A: Billing Schedule — Season Setup

Triggered alongside service occurrence generation during season setup.

### `service.ts` — createBillingSchedule()

```typescript
// Called from: POST /v1/contracts/:id/season-setup
export async function createBillingSchedule(tenantId: string, contractId: string, userId: string) {
  return await db.transaction(async (client) => {
    const contract = await ContractsRepository.getById(client, contractId, tenantId);
    if (!contract) throw new NotFoundError('Contract not found');

    const entries: BillingScheduleInsert[] = [];

    switch (contract.service_tier) {
      case 'gold':
      case 'silver': {
        // 8 equal monthly invoices: April–November
        const months = [4, 5, 6, 7, 8, 9, 10, 11]; // Apr–Nov
        for (let i = 0; i < months.length; i++) {
          const year = contract.season_start_date.getFullYear();
          entries.push({
            tenant_id: tenantId,
            contract_id: contractId,
            billing_period_start: new Date(year, months[i] - 1, 1),
            billing_period_end: endOfMonth(new Date(year, months[i] - 1)),
            billing_date: new Date(year, months[i] - 1, 1),
            invoice_number_in_season: i + 1,
            total_invoices_in_season: 8,
            planned_amount: contract.season_monthly_price,
            status: 'scheduled',
          });
        }
        break;
      }

      case 'bronze': {
        // Monthly Apr–Nov, planned_amount depends on billing type
        const months = [4, 5, 6, 7, 8, 9, 10, 11];
        for (let i = 0; i < months.length; i++) {
          const year = contract.season_start_date.getFullYear();
          entries.push({
            tenant_id: tenantId,
            contract_id: contractId,
            billing_period_start: new Date(year, months[i] - 1, 1),
            billing_period_end: endOfMonth(new Date(year, months[i] - 1)),
            billing_date: new Date(year, months[i] - 1, 1),
            invoice_number_in_season: i + 1,
            total_invoices_in_season: 8,
            planned_amount: contract.bronze_billing_type === 'flat_monthly'
              ? contract.season_monthly_price
              : null, // per_cut: computed at generation time
            status: 'scheduled',
          });
        }
        break;
      }

      case 'snow_seasonal': {
        // 5 equal monthly invoices: November–March
        const months = [11, 12, 1, 2, 3];
        for (let i = 0; i < months.length; i++) {
          const year = months[i] >= 11
            ? contract.season_start_date.getFullYear()
            : contract.season_start_date.getFullYear() + 1;
          entries.push({
            tenant_id: tenantId,
            contract_id: contractId,
            billing_period_start: new Date(year, months[i] - 1, 1),
            billing_period_end: endOfMonth(new Date(year, months[i] - 1)),
            billing_date: new Date(year, months[i] - 1, 1),
            invoice_number_in_season: i + 1,
            total_invoices_in_season: 5,
            planned_amount: contract.season_monthly_price,
            status: 'scheduled',
          });
        }
        break;
      }

      // snow_per_event and one_time: no pre-schedule (manual or event-driven)
    }

    // Bulk insert — idempotent via unique index on (contract_id, billing_period_start)
    const count = await BillingRepository.bulkInsertSchedule(client, entries);
    return { scheduled_entries: count };
  });
}
```

---

## Part B: Nightly Draft Generation

### `cron/monthly-draft-generation.ts`

```typescript
// Runs at 06:00 UTC on 1st of every month via node-cron
// Also available as manual trigger: POST /v1/billing/generate-drafts

export async function generateMonthlyDrafts(tenantId: string, billingDate: Date) {
  const dueEntries = await BillingRepository.findDueScheduleEntries(tenantId, billingDate);
  const results = { generated: 0, failed: 0, errors: [] };

  for (const entry of dueEntries) {
    try {
      const contract = await ContractsRepository.getById(db.pool, entry.contract_id, tenantId);
      let draftData: InvoiceDraftData;

      switch (contract.service_tier) {
        case 'gold':
        case 'silver':
          draftData = buildPackageInvoice(contract, entry);
          break;
        case 'bronze':
          draftData = contract.bronze_billing_type === 'per_cut'
            ? await buildPerCutInvoice(contract, entry, tenantId)
            : buildFlatMonthlyInvoice(contract, entry);
          break;
        case 'snow_seasonal':
          draftData = buildSnowSeasonalInvoice(contract, entry);
          break;
        default:
          continue; // Skip unsupported types
      }

      await db.transaction(async (client) => {
        const draft = await BillingRepository.insertDraft(client, {
          tenant_id: tenantId,
          customer_id: contract.customer_id,
          contract_id: contract.id,
          billing_schedule_id: entry.id,
          line_items: draftData.line_items,
          subtotal: draftData.subtotal,
          total_amount: draftData.total_amount,
          description: draftData.description,
          status: 'pending_review',
        });

        await BillingRepository.updateScheduleStatus(client, entry.id, 'draft', draft.id);
      });

      results.generated++;
    } catch (err) {
      results.failed++;
      results.errors.push({ contract_id: entry.contract_id, error: err.message });
      // Log error but continue with other contracts
      logger.error('Draft generation failed', { contract_id: entry.contract_id, error: err });
    }
  }

  // Notify billing employee
  if (results.generated > 0) {
    await NotificationService.dispatch({
      type: 'billing_drafts_ready',
      message: `${results.generated} invoice drafts generated. Ready for review.`,
    });
  }

  return results;
}
```

### Invoice Content Rules (NON-NEGOTIABLE)

#### Gold/Silver Package Invoice — EXACTLY ONE LINE ITEM

```typescript
function buildPackageInvoice(contract, entry): InvoiceDraftData {
  const monthName = format(entry.billing_period_start, 'MMMM yyyy');
  return {
    line_items: [{
      xero_item_code: contract.service_tier === 'gold' ? '4210-COMM-001' : '4210-COMM-002',
      description: `Monthly Landscape Maintenance — ${monthName}`,
      quantity: 1,
      unit_price: Number(contract.season_monthly_price),
      line_total: Number(contract.season_monthly_price),
      is_taxable: false,
    }],
    subtotal: Number(contract.season_monthly_price),
    total_amount: Number(contract.season_monthly_price),
    description: `${contract.service_tier === 'gold' ? 'Gold' : 'Silver'} Package — ${monthName} (${entry.invoice_number_in_season}/${entry.total_invoices_in_season})`,
  };
  // INDIVIDUAL SERVICES (fertilization, trimming, etc.) NEVER LISTED
  // This is the most important billing rule in the entire system
}
```

#### Bronze Per-Cut Invoice

```typescript
async function buildPerCutInvoice(contract, entry, tenantId): InvoiceDraftData {
  const occurrences = await OccurrenceRepository.findForBillingPeriod({
    contract_id: contract.id,
    service_code: '4210-MAINT-001', // Weekly Lawn Mowing
    period_start: entry.billing_period_start,
    period_end: entry.billing_period_end,
    statuses: ['completed', 'assigned'],
    exclude_skipped: true,
  });

  const cutCount = occurrences.length;
  const totalAmount = cutCount * Number(contract.per_cut_price);
  const monthName = format(entry.billing_period_start, 'MMMM yyyy');

  const dateList = occurrences
    .sort((a, b) => new Date(a.assigned_date).getTime() - new Date(b.assigned_date).getTime())
    .map(o => format(new Date(o.assigned_date), 'MMM d'))
    .join(' · ');

  return {
    line_items: [{
      xero_item_code: '4210-MAINT-001',
      description: `Weekly Lawn Mowing — ${monthName}\n${cutCount} cuts @ $${contract.per_cut_price} each\n${dateList}`,
      quantity: cutCount,
      unit_price: Number(contract.per_cut_price),
      line_total: totalAmount,
      is_taxable: false,
    }],
    subtotal: totalAmount,
    total_amount: totalAmount,
    description: `Bronze Per-Cut — ${monthName} (${cutCount} visits)`,
  };
}
```

---

## Part C: Draft Approval & Xero Push

### `service.ts`

```typescript
// Approve draft and push to Xero
export async function approveDraft(tenantId: string, draftId: string, userId: string) {
  return await db.transaction(async (client) => {
    const draft = await BillingRepository.getDraftById(tenantId, draftId);
    if (!draft) throw new NotFoundError('Draft not found');
    if (draft.status !== 'pending_review' && draft.status !== 'reviewed') {
      throw new BadRequestError('Only pending/reviewed drafts can be approved');
    }

    // Push to Xero
    const xeroInvoice = await XeroService.createInvoice({
      tenant_id: tenantId,
      customer_id: draft.customer_id,
      line_items: draft.line_items,
      total_amount: draft.total_amount,
      description: draft.description,
    });

    // Create CRM invoice record
    const invoice = await InvoicesRepository.insert(client, {
      tenant_id: tenantId,
      customer_id: draft.customer_id,
      xero_invoice_id: xeroInvoice.InvoiceID,
      invoice_number: xeroInvoice.InvoiceNumber,
      amount: draft.total_amount,
      status: 'awaiting_payment',
    });

    // Update draft
    await BillingRepository.updateDraft(client, draftId, {
      status: 'pushed_to_xero',
      approved_by: userId,
      approved_at: new Date(),
      pushed_to_xero: true,
      xero_invoice_id: xeroInvoice.InvoiceID,
      invoice_id: invoice.id,
    });

    // Update billing schedule
    await BillingRepository.updateScheduleStatus(client, draft.billing_schedule_id, 'approved');

    // Diary entry if linked to job
    if (draft.job_id) {
      await DiaryRepository.insert(client, {
        tenant_id: tenantId,
        job_id: draft.job_id,
        entry_type: 'invoice_pushed_xero',
        title: `Invoice ${xeroInvoice.InvoiceNumber} pushed to Xero — $${draft.total_amount}`,
        is_system_entry: true,
      });
    }

    return { invoice_id: invoice.id, xero_invoice_id: xeroInvoice.InvoiceID };
  });
}

// Reject draft
export async function rejectDraft(tenantId: string, draftId: string, reason: string, userId: string) {
  await BillingRepository.updateDraft(db.pool, draftId, {
    status: 'rejected',
    rejection_reason: reason,
    reviewed_by: userId,
    reviewed_at: new Date(),
  });
}
```

---

## Part D: Hardscape Milestone Billing

```typescript
// Trigger milestone invoice (manual — from Job Card Billing tab)
export async function triggerMilestone(tenantId: string, milestoneId: string, userId: string) {
  return await db.transaction(async (client) => {
    const milestone = await BillingRepository.getMilestoneById(tenantId, milestoneId);
    if (!milestone) throw new NotFoundError('Milestone not found');
    if (milestone.status !== 'pending') throw new BadRequestError('Only pending milestones can be triggered');

    // Compute amount if percentage
    const amount = milestone.amount_type === 'percentage'
      ? Number(milestone.project_total) * Number(milestone.amount_value) / 100
      : Number(milestone.amount_value);

    // Create draft (NOT pushed to Xero — still needs approval)
    const draft = await BillingRepository.insertDraft(client, {
      tenant_id: tenantId,
      customer_id: milestone.customer_id,
      contract_id: milestone.contract_id,
      line_items: [{
        description: `${milestone.milestone_name} — ${milestone.milestone_description ?? ''}`,
        quantity: 1,
        unit_price: amount,
        line_total: amount,
      }],
      subtotal: amount,
      total_amount: amount,
      description: `Hardscape Milestone: ${milestone.milestone_name}`,
      status: 'pending_review',
    });

    await BillingRepository.updateMilestone(client, milestoneId, {
      status: 'invoiced',
      computed_amount: amount,
      triggered_at: new Date(),
      updated_by: userId,
    });

    return draft;
  });
}
```

---

## Part E: Xero Payment Webhook

```typescript
// POST /v1/webhooks/xero — Payment status sync FROM Xero
export async function handleXeroWebhook(payload: XeroWebhookPayload) {
  // Validate HMAC signature
  // ...

  for (const event of payload.events) {
    if (event.eventType === 'INVOICE' && event.eventCategory === 'PAID') {
      await handleInvoicePaid(event);
    }
  }
}

async function handleInvoicePaid(event: XeroEvent) {
  const invoice = await InvoicesRepository.findByXeroId(event.resourceId);
  if (!invoice) return; // Not our invoice

  await InvoicesRepository.update(invoice.id, {
    status: 'paid',
    paid_at: new Date(event.eventDateUtc),
  });

  // Diary entry if linked to job
  if (invoice.job_id) {
    await DiaryRepository.insert(db.pool, {
      tenant_id: invoice.tenant_id,
      job_id: invoice.job_id,
      entry_type: 'invoice_paid',
      title: `Invoice ${invoice.invoice_number} paid — $${invoice.amount}`,
      is_system_entry: true,
    });
  }
}
```

---

## Part F: API Endpoints

### `routes.ts`

```typescript
// Billing Dashboard
router.get('/v1/billing/dashboard', authenticate, tenantScope, requireRole('owner', 'div_mgr'), ctrl.getDashboard);

// Drafts
router.get('/v1/billing/drafts', authenticate, tenantScope, requireRole('owner', 'div_mgr'), ctrl.listDrafts);
router.get('/v1/billing/drafts/:id', authenticate, tenantScope, requireRole('owner', 'div_mgr'), ctrl.getDraft);
router.patch('/v1/billing/drafts/:id', authenticate, tenantScope, requireRole('owner'), validate(updateDraftSchema), ctrl.updateDraft);
router.post('/v1/billing/drafts/:id/approve', authenticate, tenantScope, requireRole('owner'), ctrl.approveDraft);
router.post('/v1/billing/drafts/:id/reject', authenticate, tenantScope, requireRole('owner'), validate(rejectDraftSchema), ctrl.rejectDraft);

// Generation & Schedule
router.post('/v1/billing/generate-drafts', authenticate, tenantScope, requireRole('owner'), ctrl.manualGenerateDrafts);
router.get('/v1/billing/schedule', authenticate, tenantScope, requireRole('owner', 'div_mgr'), ctrl.listSchedule);
router.get('/v1/billing/overdue', authenticate, tenantScope, requireRole('owner', 'div_mgr'), ctrl.listOverdue);

// Milestones
router.post('/v1/billing/milestones/:id/trigger', authenticate, tenantScope, requireRole('owner'), ctrl.triggerMilestone);

// Xero Webhook
router.post('/v1/webhooks/xero', ctrl.handleXeroWebhook); // No auth — uses HMAC validation
```

---

## Business Rules (Non-Negotiable)

1. **Drafts ONLY** — no auto-push to Xero. Every draft needs human approval.
2. **Nightly generation idempotent** — running twice does NOT create duplicates
3. **Gold/Silver: EXACTLY ONE line item** — individual services NEVER listed
4. **Bronze per-cut:** one line item with cut count, price, and date list
5. **If generation fails for one contract:** log error, notify, continue with others
6. **If Xero push fails:** status remains draft, error logged, retry button shown
7. **Payment sync FROM Xero via webhook only** — CRM never polls Xero

---

## Testing

Write tests for:
1. Billing schedule creation for each contract type
2. Gold/Silver draft: exactly ONE line item
3. Bronze per-cut draft: correct cut count from occurrences
4. Draft approval flow (status transitions)
5. Rejection with reason
6. Idempotent draft generation
7. Milestone trigger + amount computation
8. Xero webhook payment sync

## Done When
- [ ] Season setup creates billing schedule
- [ ] Nightly draft generation for all contract types
- [ ] Gold/Silver: single line item rule enforced
- [ ] Bronze: occurrence-based billing
- [ ] Draft approval → Xero push
- [ ] Milestone billing for hardscape
- [ ] Xero webhook for payment sync
- [ ] All tests pass
- [ ] Committed to branch
