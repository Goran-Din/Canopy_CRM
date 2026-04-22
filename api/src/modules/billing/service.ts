import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';
import * as repo from './repository.js';
import * as contractRepo from '../contracts/repository.js';
import * as occurrenceRepo from '../service-occurrences/repository.js';
import * as diaryRepo from '../jobs/diary/diary.repository.js';
import * as jobRepo from '../jobs/repository.js';
import type {
  UpdateDraftInput,
  RejectDraftInput,
  DraftQuery,
  ScheduleQuery,
  SetupMilestonesInput,
  AddMilestoneInput,
  UpdateMilestoneInput,
  CancelMilestoneInput,
} from './schema.js';

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// === Billing Schedule ===

export async function createBillingSchedule(
  tenantId: string,
  contractId: string,
  _userId: string,
) {
  const contract = await contractRepo.findById(tenantId, contractId);
  if (!contract) throw new AppError(404, 'Contract not found');

  const c = contract as unknown as Record<string, unknown>;
  const serviceTier = c.service_tier as string | undefined;
  const seasonStartDate = c.season_start_date as string | undefined;

  if (!serviceTier || !seasonStartDate) {
    return { scheduled_entries: 0 };
  }

  const entries: repo.BillingScheduleInsert[] = [];
  const baseYear = new Date(seasonStartDate).getFullYear();
  const monthlyPrice = Number(c.season_monthly_price ?? 0);

  switch (serviceTier) {
    case 'gold':
    case 'silver': {
      const months = [4, 5, 6, 7, 8, 9, 10, 11];
      for (let i = 0; i < months.length; i++) {
        entries.push({
          tenant_id: tenantId,
          contract_id: contractId,
          billing_period_start: new Date(baseYear, months[i] - 1, 1),
          billing_period_end: endOfMonth(new Date(baseYear, months[i] - 1, 1)),
          billing_date: new Date(baseYear, months[i] - 1, 1),
          invoice_number_in_season: i + 1,
          total_invoices_in_season: 8,
          planned_amount: monthlyPrice,
          status: 'scheduled',
        });
      }
      break;
    }
    case 'bronze': {
      const months = [4, 5, 6, 7, 8, 9, 10, 11];
      const bronzeBillingType = c.bronze_billing_type as string | undefined;
      for (let i = 0; i < months.length; i++) {
        entries.push({
          tenant_id: tenantId,
          contract_id: contractId,
          billing_period_start: new Date(baseYear, months[i] - 1, 1),
          billing_period_end: endOfMonth(new Date(baseYear, months[i] - 1, 1)),
          billing_date: new Date(baseYear, months[i] - 1, 1),
          invoice_number_in_season: i + 1,
          total_invoices_in_season: 8,
          planned_amount: bronzeBillingType === 'flat_monthly' ? monthlyPrice : null,
          status: 'scheduled',
        });
      }
      break;
    }
    case 'snow_seasonal': {
      const months = [11, 12, 1, 2, 3];
      for (let i = 0; i < months.length; i++) {
        const year = months[i] >= 11 ? baseYear : baseYear + 1;
        entries.push({
          tenant_id: tenantId,
          contract_id: contractId,
          billing_period_start: new Date(year, months[i] - 1, 1),
          billing_period_end: endOfMonth(new Date(year, months[i] - 1, 1)),
          billing_date: new Date(year, months[i] - 1, 1),
          invoice_number_in_season: i + 1,
          total_invoices_in_season: 5,
          planned_amount: monthlyPrice,
          status: 'scheduled',
        });
      }
      break;
    }
    // snow_per_event, one_time: no pre-schedule
  }

  if (entries.length === 0) return { scheduled_entries: 0 };

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const count = await repo.bulkInsertSchedule(client, entries);
    await client.query('COMMIT');
    return { scheduled_entries: count };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Draft Generation ===

interface DraftLineItem {
  xero_item_code?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_taxable?: boolean;
}

interface InvoiceDraftData {
  line_items: DraftLineItem[];
  subtotal: number;
  total_amount: number;
  description: string;
}

function buildPackageInvoice(
  contract: Record<string, unknown>,
  entry: repo.BillingScheduleEntry,
): InvoiceDraftData {
  const serviceTier = contract.service_tier as string;
  const monthlyPrice = Number(contract.season_monthly_price ?? 0);
  const monthName = formatMonth(new Date(entry.billing_period_start));
  const itemCode = serviceTier === 'gold' ? '4210-COMM-001' : '4210-COMM-002';

  return {
    line_items: [{
      xero_item_code: itemCode,
      description: `Monthly Landscape Maintenance — ${monthName}`,
      quantity: 1,
      unit_price: monthlyPrice,
      line_total: monthlyPrice,
      is_taxable: false,
    }],
    subtotal: monthlyPrice,
    total_amount: monthlyPrice,
    description: `${serviceTier === 'gold' ? 'Gold' : 'Silver'} Package — ${monthName} (${entry.invoice_number_in_season}/${entry.total_invoices_in_season})`,
  };
}

async function buildPerCutInvoice(
  contract: Record<string, unknown>,
  entry: repo.BillingScheduleEntry,
  tenantId: string,
): Promise<InvoiceDraftData> {
  const perCutPrice = Number(contract.per_cut_price ?? 0);
  const monthName = formatMonth(new Date(entry.billing_period_start));

  const occurrences = await occurrenceRepo.findForBillingPeriod(
    tenantId,
    entry.contract_id,
    '4210-MAINT-001',
    entry.billing_period_start,
    entry.billing_period_end,
  );

  const cutCount = occurrences.length;
  const totalAmount = cutCount * perCutPrice;

  const dateList = occurrences
    .filter(o => o.assigned_date)
    .sort((a, b) => new Date(a.assigned_date!).getTime() - new Date(b.assigned_date!).getTime())
    .map(o => new Date(o.assigned_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    .join(' · ');

  return {
    line_items: [{
      xero_item_code: '4210-MAINT-001',
      description: `Weekly Lawn Mowing — ${monthName}\n${cutCount} cuts @ $${perCutPrice} each${dateList ? `\n${dateList}` : ''}`,
      quantity: cutCount,
      unit_price: perCutPrice,
      line_total: totalAmount,
      is_taxable: false,
    }],
    subtotal: totalAmount,
    total_amount: totalAmount,
    description: `Bronze Per-Cut — ${monthName} (${cutCount} visits)`,
  };
}

function buildFlatMonthlyInvoice(
  contract: Record<string, unknown>,
  entry: repo.BillingScheduleEntry,
): InvoiceDraftData {
  const monthlyPrice = Number(contract.season_monthly_price ?? 0);
  const monthName = formatMonth(new Date(entry.billing_period_start));

  return {
    line_items: [{
      xero_item_code: '4210-MAINT-001',
      description: `Monthly Lawn Maintenance — ${monthName}`,
      quantity: 1,
      unit_price: monthlyPrice,
      line_total: monthlyPrice,
      is_taxable: false,
    }],
    subtotal: monthlyPrice,
    total_amount: monthlyPrice,
    description: `Bronze Flat Monthly — ${monthName} (${entry.invoice_number_in_season}/${entry.total_invoices_in_season})`,
  };
}

function buildSnowSeasonalInvoice(
  contract: Record<string, unknown>,
  entry: repo.BillingScheduleEntry,
): InvoiceDraftData {
  const monthlyPrice = Number(contract.season_monthly_price ?? 0);
  const monthName = formatMonth(new Date(entry.billing_period_start));

  return {
    line_items: [{
      xero_item_code: '4220-SNOW-001',
      description: `Snow Removal Service — ${monthName}`,
      quantity: 1,
      unit_price: monthlyPrice,
      line_total: monthlyPrice,
      is_taxable: false,
    }],
    subtotal: monthlyPrice,
    total_amount: monthlyPrice,
    description: `Snow Seasonal — ${monthName} (${entry.invoice_number_in_season}/${entry.total_invoices_in_season})`,
  };
}

export async function generateMonthlyDrafts(tenantId: string, billingDate: string) {
  const dueEntries = await repo.findDueScheduleEntries(tenantId, billingDate);
  const results = { generated: 0, failed: 0, errors: [] as Array<{ contract_id: string; error: string }> };

  for (const entry of dueEntries) {
    try {
      const contract = await contractRepo.findById(tenantId, entry.contract_id);
      if (!contract) continue;

      const c = contract as unknown as Record<string, unknown>;
      const serviceTier = c.service_tier as string;
      let draftData: InvoiceDraftData;

      switch (serviceTier) {
        case 'gold':
        case 'silver':
          draftData = buildPackageInvoice(c, entry);
          break;
        case 'bronze':
          draftData = (c.bronze_billing_type as string) === 'per_cut'
            ? await buildPerCutInvoice(c, entry, tenantId)
            : buildFlatMonthlyInvoice(c, entry);
          break;
        case 'snow_seasonal':
          draftData = buildSnowSeasonalInvoice(c, entry);
          break;
        default:
          continue;
      }

      const client = await repo.acquireClient();
      try {
        await client.query('BEGIN');

        const draft = await repo.insertDraft(client, {
          tenant_id: tenantId,
          customer_id: c.customer_id,
          contract_id: contract.id,
          billing_schedule_id: entry.id,
          line_items: draftData.line_items,
          subtotal: draftData.subtotal,
          total_amount: draftData.total_amount,
          description: draftData.description,
          status: 'pending_review',
        });

        await repo.updateScheduleStatus(client, entry.id, 'draft', draft.id);
        await client.query('COMMIT');
        results.generated++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ contract_id: entry.contract_id, error: (err as Error).message });
      logger.error('Draft generation failed', { contract_id: entry.contract_id, error: (err as Error).message });
    }
  }

  return results;
}

// === Draft Management ===

export async function listDrafts(tenantId: string, query: DraftQuery) {
  const { rows, total } = await repo.findDrafts(tenantId, query);
  return {
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getDraft(tenantId: string, draftId: string) {
  const draft = await repo.getDraftById(tenantId, draftId);
  if (!draft) throw new AppError(404, 'Draft not found');
  return draft;
}

export async function updateDraft(tenantId: string, draftId: string, input: UpdateDraftInput) {
  const draft = await repo.getDraftById(tenantId, draftId);
  if (!draft) throw new AppError(404, 'Draft not found');
  if (draft.status !== 'pending_review' && draft.status !== 'reviewed') {
    throw new AppError(400, 'Only pending/reviewed drafts can be edited');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const updated = await repo.updateDraft(client, draftId, input);
    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function approveDraft(tenantId: string, draftId: string, userId: string) {
  const draft = await repo.getDraftById(tenantId, draftId);
  if (!draft) throw new AppError(404, 'Draft not found');
  if (draft.status !== 'pending_review' && draft.status !== 'reviewed') {
    throw new AppError(400, 'Only pending/reviewed drafts can be approved');
  }

  // In production: push to Xero here, create CRM invoice record
  // For now: update status to approved (Xero push is a separate integration step)
  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const updated = await repo.updateDraft(client, draftId, {
      status: 'approved',
      approved_by: userId,
      approved_at: new Date(),
    });

    if (draft.billing_schedule_id) {
      await repo.updateScheduleStatus(client, draft.billing_schedule_id, 'approved');
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectDraft(tenantId: string, draftId: string, input: RejectDraftInput, userId: string) {
  const draft = await repo.getDraftById(tenantId, draftId);
  if (!draft) throw new AppError(404, 'Draft not found');

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const updated = await repo.updateDraft(client, draftId, {
      status: 'rejected',
      rejection_reason: input.reason,
      reviewed_by: userId,
      reviewed_at: new Date(),
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

// === Milestones ===

export async function triggerMilestone(tenantId: string, milestoneId: string, userId: string) {
  const milestone = await repo.getMilestoneById(tenantId, milestoneId);
  if (!milestone) throw new AppError(404, 'Milestone not found');
  if (milestone.status !== 'pending') throw new AppError(400, 'Only pending milestones can be triggered');

  const amount = milestone.amount_type === 'percentage'
    ? Number(milestone.project_total ?? 0) * Number(milestone.amount_value) / 100
    : Number(milestone.amount_value);

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const draft = await repo.insertDraft(client, {
      tenant_id: tenantId,
      customer_id: milestone.customer_id,
      contract_id: milestone.contract_id,
      line_items: [{
        description: `${milestone.milestone_name}${milestone.milestone_description ? ` — ${milestone.milestone_description}` : ''}`,
        quantity: 1,
        unit_price: Math.round(amount * 100) / 100,
        line_total: Math.round(amount * 100) / 100,
      }],
      subtotal: Math.round(amount * 100) / 100,
      total_amount: Math.round(amount * 100) / 100,
      description: `Hardscape Milestone: ${milestone.milestone_name}`,
      status: 'pending_review',
    });

    await repo.updateMilestone(client, milestoneId, {
      status: 'invoiced',
      computed_amount: Math.round(amount * 100) / 100,
      triggered_at: new Date(),
      updated_by: userId,
    });

    await client.query('COMMIT');
    return draft;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// === Dashboard & Schedule ===

export async function getDashboard(tenantId: string) {
  return repo.getDashboardStats(tenantId);
}

export async function listSchedule(tenantId: string, query: ScheduleQuery) {
  const { rows, total } = await repo.findSchedule(tenantId, query);
  return {
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function listOverdue(tenantId: string) {
  return repo.findOverdue(tenantId);
}

// === Milestone Setup & CRUD ===

export async function listMilestones(tenantId: string, jobId: string) {
  const milestones = await repo.findMilestonesByJobId(jobId, tenantId);

  const nonCancelled = milestones.filter(m => m.status !== 'cancelled');
  const projectTotal = nonCancelled.reduce((sum, m) => sum + Number(m.computed_amount ?? 0), 0);
  const invoicedToDate = nonCancelled
    .filter(m => ['invoiced', 'approved', 'paid'].includes(m.status))
    .reduce((sum, m) => sum + Number(m.computed_amount ?? 0), 0);
  const collected = nonCancelled
    .filter(m => m.status === 'paid')
    .reduce((sum, m) => sum + Number(m.computed_amount ?? 0), 0);
  const outstanding = projectTotal - collected;
  const invoicedPercent = projectTotal > 0
    ? Math.round((invoicedToDate / projectTotal) * 100)
    : 0;

  return {
    project_total: Math.round(projectTotal * 100) / 100,
    invoiced_to_date: Math.round(invoicedToDate * 100) / 100,
    collected: Math.round(collected * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
    invoiced_percent: invoicedPercent,
    milestones,
  };
}

export async function setupMilestones(
  tenantId: string,
  jobId: string,
  input: SetupMilestonesInput,
  userId: string,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) throw new AppError(404, 'Job not found');
  if (job.division !== 'hardscape') {
    throw new AppError(422, 'Milestone billing is only available for hardscape jobs');
  }

  // Validate milestone amounts sum correctly
  const projectTotal = input.project_total;
  let computedSum = 0;
  const computed: Array<{ data: (typeof input.milestones)[number]; computed_amount: number }> = [];

  for (const m of input.milestones) {
    const computedAmount = m.amount_type === 'percentage'
      ? m.amount_value * projectTotal
      : m.amount_value;
    computedSum += computedAmount;
    computed.push({ data: m, computed_amount: Math.round(computedAmount * 100) / 100 });
  }

  if (Math.abs(Math.round(computedSum * 100) / 100 - projectTotal) > 0.01) {
    throw new AppError(422, `Milestone amounts sum to $${(Math.round(computedSum * 100) / 100).toFixed(2)} but project total is $${projectTotal.toFixed(2)}`);
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const milestoneData = computed.map(c => ({
      milestone_name: c.data.milestone_name,
      milestone_description: c.data.milestone_description,
      amount_type: c.data.amount_type,
      amount_value: c.data.amount_value,
      computed_amount: c.computed_amount,
      project_total: projectTotal,
      sort_order: c.data.sort_order,
      due_date: c.data.due_date,
      contract_id: job.contract_id,
      created_by: userId,
    }));

    const milestones = await repo.createMilestones(client, jobId, tenantId, milestoneData);

    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: jobId,
      entry_type: 'milestone_setup',
      title: `Milestone billing plan created — ${milestones.length} milestones, $${projectTotal.toFixed(2)} total`,
      metadata: { milestone_count: milestones.length, project_total: projectTotal },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
    return milestones;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function addMilestone(
  tenantId: string,
  jobId: string,
  input: AddMilestoneInput,
  userId: string,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) throw new AppError(404, 'Job not found');

  // Get existing milestones to derive project_total
  const existing = await repo.findMilestonesByJobId(jobId, tenantId);
  const projectTotal = existing.length > 0
    ? Number(existing[0].project_total ?? 0)
    : 0;

  const computedAmount = input.amount_type === 'percentage'
    ? Math.round(input.amount_value * projectTotal * 100) / 100
    : Math.round(input.amount_value * 100) / 100;

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const milestone = await repo.createSingleMilestone(client, jobId, tenantId, {
      milestone_name: input.milestone_name,
      milestone_description: input.milestone_description,
      amount_type: input.amount_type,
      amount_value: input.amount_value,
      computed_amount: computedAmount,
      project_total: projectTotal,
      sort_order: input.sort_order,
      due_date: input.due_date,
      contract_id: job.contract_id,
      created_by: userId,
    });
    await client.query('COMMIT');
    return milestone;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateMilestoneFields(
  tenantId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
  userId: string,
) {
  const milestone = await repo.getMilestoneById(tenantId, milestoneId);
  if (!milestone) throw new AppError(404, 'Milestone not found');
  if (milestone.status !== 'pending') {
    throw new AppError(422, `Cannot edit a ${milestone.status} milestone — only pending milestones can be modified`);
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const updated = await repo.updateMilestone(client, milestoneId, {
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

export async function generateMilestoneInvoice(
  tenantId: string,
  milestoneId: string,
  userId: string,
) {
  const milestone = await repo.getMilestoneById(tenantId, milestoneId);
  if (!milestone) throw new AppError(404, 'Milestone not found');
  if (milestone.status !== 'pending') {
    throw new AppError(422, `Cannot generate invoice for a ${milestone.status} milestone — only pending milestones`);
  }

  const amount = Number(milestone.computed_amount ?? 0);

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    const draft = await repo.insertDraft(client, {
      tenant_id: tenantId,
      customer_id: milestone.customer_id,
      contract_id: milestone.contract_id,
      line_items: [{
        description: `${milestone.milestone_name}${milestone.milestone_description ? ` — ${milestone.milestone_description}` : ''}`,
        quantity: 1,
        unit_price: Math.round(amount * 100) / 100,
        line_total: Math.round(amount * 100) / 100,
      }],
      subtotal: Math.round(amount * 100) / 100,
      total_amount: Math.round(amount * 100) / 100,
      description: `Hardscape Milestone: ${milestone.milestone_name}`,
      status: 'pending_review',
    });

    await repo.updateMilestone(client, milestoneId, {
      status: 'invoiced',
      invoice_id: draft.id,
      triggered_at: new Date(),
      updated_by: userId,
    });

    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: milestone.job_id,
      entry_type: 'milestone_invoiced',
      title: `Milestone invoice generated: ${milestone.milestone_name} — $${amount.toFixed(2)}`,
      metadata: { milestone_id: milestoneId, draft_id: draft.id, amount },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');

    const updated = await repo.getMilestoneById(tenantId, milestoneId);
    return { draft, milestone: updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelMilestone(
  tenantId: string,
  milestoneId: string,
  input: CancelMilestoneInput,
  userId: string,
) {
  const milestone = await repo.getMilestoneById(tenantId, milestoneId);
  if (!milestone) throw new AppError(404, 'Milestone not found');
  if (milestone.status !== 'pending') {
    throw new AppError(422, `Cannot cancel a ${milestone.status} milestone — only pending milestones can be cancelled`);
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const cancelled = await repo.cancelMilestone(client, milestoneId, tenantId, input.reason, userId);

    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: milestone.job_id,
      entry_type: 'milestone_cancelled',
      title: `Milestone cancelled: ${milestone.milestone_name} — ${input.reason}`,
      metadata: { milestone_id: milestoneId, reason: input.reason },
      created_by_user_id: userId,
      is_system_entry: false,
    });

    await client.query('COMMIT');
    return cancelled;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function recalculatePendingMilestones(
  tenantId: string,
  jobId: string,
  newProjectTotal: number,
  userId: string,
) {
  const milestones = await repo.findMilestonesByJobId(jobId, tenantId);
  const pendingPercentage = milestones.filter(
    m => m.status === 'pending' && m.amount_type === 'percentage',
  );

  if (pendingPercentage.length === 0) return milestones;

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    for (const m of pendingPercentage) {
      const newAmount = Math.round(Number(m.amount_value) * newProjectTotal * 100) / 100;
      await repo.updateMilestone(client, m.id, {
        computed_amount: newAmount,
        project_total: newProjectTotal,
        updated_by: userId,
      });
    }

    await client.query('COMMIT');
    return repo.findMilestonesByJobId(jobId, tenantId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getHardscapeSummary(tenantId: string) {
  return repo.getHardscapeBillingSummary(tenantId);
}
