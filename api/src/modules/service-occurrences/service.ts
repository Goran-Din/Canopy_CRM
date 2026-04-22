import { AppError } from '../../middleware/errorHandler.js';
import * as repo from './repository.js';
import * as contractRepo from '../contracts/repository.js';
import * as jobRepo from '../jobs/repository.js';
import * as diaryRepo from '../jobs/diary/diary.repository.js';
import type {
  AssignOccurrenceInput,
  BulkAssignInput,
  SkipOccurrenceInput,
  OccurrenceQuery,
} from './schema.js';

interface PackageService {
  service_code: string;
  service_name: string;
  occurrence_type: string;
  occurrence_count: number;
  preferred_months?: string[];
  notes?: string;
}

/**
 * Season setup — generate occurrences from contract's package_services JSONB.
 */
export async function generateOccurrences(
  tenantId: string,
  contractId: string,
  seasonYear: number,
  userId: string,
) {
  const contract = await contractRepo.findById(tenantId, contractId);
  if (!contract) {
    throw new AppError(404, 'Contract not found');
  }

  const packageServices = (contract as unknown as Record<string, unknown>).package_services as PackageService[] | undefined;
  if (!packageServices || !Array.isArray(packageServices) || packageServices.length === 0) {
    throw new AppError(400, 'Contract has no package services defined');
  }

  const serviceTier = (contract as unknown as Record<string, unknown>).service_tier as string | undefined;
  const occurrences: repo.OccurrenceInsert[] = [];

  for (const service of packageServices) {
    // SKIP weekly services (use V1 recurring job system)
    if (service.occurrence_type === 'weekly') continue;

    const count = service.occurrence_type === 'one_time' ? 1 : (service.occurrence_count || 1);
    for (let i = 1; i <= count; i++) {
      occurrences.push({
        tenant_id: tenantId,
        contract_id: contractId,
        property_id: contract.property_id,
        customer_id: contract.customer_id,
        service_code: service.service_code,
        service_name: service.service_name,
        occurrence_number: i,
        season_year: seasonYear,
        status: 'pending',
        preferred_month: service.preferred_months?.[i - 1] ?? null,
        is_included_in_invoice: serviceTier === 'bronze',
        notes: service.notes ?? null,
      });
    }
  }

  if (occurrences.length === 0) {
    return { total_generated: 0, inserted: 0 };
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    const insertedCount = await repo.bulkInsert(client, occurrences);
    await client.query('COMMIT');
    return { total_generated: occurrences.length, inserted: insertedCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List occurrences with filters.
 */
export async function listOccurrences(tenantId: string, query: OccurrenceQuery) {
  const { rows, total } = await repo.findAll(tenantId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/**
 * Get single occurrence.
 */
export async function getOccurrence(tenantId: string, id: string) {
  const occ = await repo.getById(tenantId, id);
  if (!occ) {
    throw new AppError(404, 'Occurrence not found');
  }
  return occ;
}

/**
 * Assign occurrence → create job.
 */
export async function assignOccurrence(
  tenantId: string,
  occurrenceId: string,
  input: AssignOccurrenceInput,
  userId: string,
) {
  const occ = await repo.getById(tenantId, occurrenceId);
  if (!occ) {
    throw new AppError(404, 'Occurrence not found');
  }
  if (occ.status !== 'pending') {
    throw new AppError(400, 'Only pending occurrences can be assigned');
  }

  const totalCount = await repo.countByContractService(
    tenantId, occ.contract_id, occ.service_code, occ.season_year,
  );

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    // Get job number
    const currentYear = new Date().getFullYear();
    const jobNumber = await jobRepo.getNextJobNumber(client, tenantId, currentYear);

    // Create job
    const job = await jobRepo.createWithClient(client, tenantId, {
      customer_id: occ.customer_id,
      property_id: occ.property_id,
      division: 'landscaping_maintenance',
      job_type: 'scheduled_service',
      title: `${occ.service_name} — ${occ.occurrence_number}/${totalCount}`,
      creation_path: 'instant_work_order',
      status: 'unscheduled',
      priority: 'normal',
      scheduled_date: input.assigned_date,
      job_number: jobNumber,
    }, userId);

    // Diary entry for job creation
    await diaryRepo.insert(client, {
      tenant_id: tenantId,
      job_id: job.id,
      entry_type: 'job_created',
      title: `Job #${jobNumber} created from service occurrence`,
      metadata: { occurrence_id: occurrenceId, service_code: occ.service_code },
      created_by_user_id: userId,
      is_system_entry: true,
    });

    // Update occurrence
    await repo.update(client, occurrenceId, tenantId, {
      status: 'assigned',
      assigned_date: input.assigned_date,
      job_id: job.id,
      notes: input.notes,
    });

    await client.query('COMMIT');
    return { job, occurrence_id: occurrenceId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Bulk assign — create one job per occurrence.
 */
export async function bulkAssign(
  tenantId: string,
  input: BulkAssignInput,
  userId: string,
) {
  const results = [];
  for (const id of input.occurrence_ids) {
    const result = await assignOccurrence(tenantId, id, {
      assigned_date: input.assigned_date,
      notes: input.notes,
    }, userId);
    results.push(result);
  }
  return { jobs_created: results.length, occurrences_assigned: results.length };
}

/**
 * Skip occurrence.
 */
export async function skipOccurrence(
  tenantId: string,
  occurrenceId: string,
  input: SkipOccurrenceInput,
  userId: string,
) {
  const occ = await repo.getById(tenantId, occurrenceId);
  if (!occ) {
    throw new AppError(404, 'Occurrence not found');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');

    await repo.update(client, occurrenceId, tenantId, {
      status: 'skipped',
      skipped_reason: input.skipped_reason,
      skipped_date: input.skipped_date,
      recovery_date: input.recovery_date ?? null,
    });

    // If occurrence had a job → skip the job too
    if (occ.job_id) {
      await jobRepo.updateStatusWithClient(
        client, tenantId, occ.job_id, 'skipped', null, userId,
      );

      await diaryRepo.insert(client, {
        tenant_id: tenantId,
        job_id: occ.job_id,
        entry_type: 'status_change',
        title: `Visit skipped — ${input.skipped_reason}`,
        metadata: { occurrence_id: occurrenceId, reason: input.skipped_reason },
        is_system_entry: true,
      });
    }

    await client.query('COMMIT');
    return { occurrence_id: occurrenceId, status: 'skipped' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Mark occurrence as completed (called when job completes).
 */
export async function markCompleted(tenantId: string, occurrenceId: string) {
  const occ = await repo.getById(tenantId, occurrenceId);
  if (!occ) {
    throw new AppError(404, 'Occurrence not found');
  }

  const client = await repo.acquireClient();
  try {
    await client.query('BEGIN');
    await repo.update(client, occurrenceId, tenantId, { status: 'completed' });
    await client.query('COMMIT');
    return { occurrence_id: occurrenceId, status: 'completed' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Service list summary.
 */
export async function getServiceListSummary(tenantId: string, seasonYear: number) {
  return repo.getServiceListSummary(tenantId, seasonYear);
}

/**
 * Service detail for a specific service + round.
 */
export async function getServiceDetail(
  tenantId: string,
  serviceCode: string,
  occurrenceNumber: number,
  seasonYear: number,
) {
  return repo.getServiceDetail(tenantId, serviceCode, occurrenceNumber, seasonYear);
}

/**
 * Season summary stats.
 */
export async function getSeasonSummary(tenantId: string, seasonYear: number) {
  return repo.getSeasonSummary(tenantId, seasonYear);
}
