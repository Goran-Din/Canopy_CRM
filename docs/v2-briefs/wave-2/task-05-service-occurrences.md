# Wave 2, Task 5: Service Occurrences Module (D-28)

> **Branch:** `feature/wave2-service-occurrences`
> **Source docs:** D-28 (Service Occurrence & Work Order Generation)
> **Dependencies:** Task 1 (Job Pipeline — job creation), Wave 1 migrations 029-030
> **Build order:** After Job Pipeline

---

## Overview

Operational scheduling engine. Converts Gold/Silver package service lists (stored in contract `package_services` JSONB) into concrete, trackable service occurrences. Coordinators assign dates → jobs automatically created. Tracks completion, skipped visits, recovery dates.

**Scope:**
- Gold/Silver package service occurrences (floating scheduling)
- Service list queries (coordinator's operational view)
- Bulk occurrence assignment
- Skipped visit management
- Season completion tracking
- **NOT** weekly mowing (V1 recurring job system) or snow events (D-8)

## Files to Create

```
api/src/modules/service-occurrences/
├── controller.ts
├── service.ts
├── repository.ts
├── schema.ts
├── routes.ts
└── __tests__/
```

---

## Part A: Repository

### `repository.ts`

```typescript
// Bulk insert occurrences (idempotent — ON CONFLICT DO NOTHING)
export async function bulkInsert(client: PoolClient, occurrences: OccurrenceInsert[]): Promise<number> {
  // Build multi-row INSERT
  // INSERT INTO service_occurrences (tenant_id, contract_id, property_id, customer_id,
  //   service_code, service_name, occurrence_number, season_year, status,
  //   preferred_month, is_included_in_invoice, notes)
  // VALUES ($1,$2,...), ($N+1,$N+2,...), ...
  // ON CONFLICT (contract_id, service_code, occurrence_number, season_year) DO NOTHING
  // RETURNING id
  // NOTE: You may need a unique index for idempotency — add if not in migration
}

// Find occurrences (filterable)
export async function findAll(
  tenantId: string, query: OccurrenceQuery
): Promise<{ rows: ServiceOccurrence[]; total: number }> {
  // WHERE tenant_id=$1
  // AND (season_year=$N OR $N IS NULL)
  // AND (service_code=$N OR $N IS NULL)
  // AND (status=$N OR $N IS NULL)
  // AND (contract_id=$N OR $N IS NULL)
  // AND (property_id=$N OR $N IS NULL)
  // JOIN customers, properties for display names
  // ORDER BY service_code, occurrence_number
}

// Get single occurrence
export async function getById(tenantId: string, id: string): Promise<ServiceOccurrence | null> {
  // WHERE id=$1 AND tenant_id=$2
}

// Update occurrence (assign, skip, complete)
export async function update(
  client: PoolClient, id: string, tenantId: string, updates: Partial<ServiceOccurrence>
): Promise<ServiceOccurrence> {
  // Dynamic UPDATE ... SET ... WHERE id=$1 AND tenant_id=$2 RETURNING *
}

// Service List Summary — aggregate view
export async function getServiceListSummary(tenantId: string, seasonYear: number): Promise<ServiceListSummary[]> {
  const result = await queryDb(
    `SELECT
       service_code,
       service_name,
       COUNT(DISTINCT property_id) as total_properties,
       occurrence_number,
       COUNT(*) FILTER (WHERE status = 'pending') as pending,
       COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
       COUNT(*) FILTER (WHERE status = 'completed') as completed,
       COUNT(*) FILTER (WHERE status = 'skipped') as skipped
     FROM service_occurrences
     WHERE tenant_id = $1 AND season_year = $2
     GROUP BY service_code, service_name, occurrence_number
     ORDER BY service_code, occurrence_number`,
    [tenantId, seasonYear]
  );
  return result.rows;
}

// Service Detail — properties for specific service + round
export async function getServiceDetail(
  tenantId: string, serviceCode: string, occurrenceNumber: number, seasonYear: number
): Promise<ServiceDetailRow[]> {
  // SELECT so.*, c.display_name, c.customer_number,
  //        p.street_address, p.property_category,
  //        j.job_number
  // FROM service_occurrences so
  // JOIN customers c ON so.customer_id = c.id
  // JOIN properties p ON so.property_id = p.id
  // LEFT JOIN jobs j ON so.job_id = j.id
  // WHERE so.tenant_id=$1 AND so.service_code=$2
  //   AND so.occurrence_number=$3 AND so.season_year=$4
  // ORDER BY c.display_name
}

// Season summary stats
export async function getSeasonSummary(tenantId: string, seasonYear: number): Promise<SeasonSummary> {
  // SELECT COUNT(*), COUNT by status, GROUP BY service_name for breakdown
}

// Find occurrences for billing period (used by Billing Engine D-29)
export async function findForBillingPeriod(options: BillingPeriodQuery): Promise<ServiceOccurrence[]> {
  // WHERE contract_id=$1 AND service_code=$2
  //   AND assigned_date >= $3 AND assigned_date <= $4
  //   AND status IN ('completed', 'assigned')
  //   AND status != 'skipped'
}
```

---

## Part B: Service Layer

### `service.ts`

```typescript
// Season setup — generate occurrences from contract's package_services JSONB
export async function generateOccurrences(tenantId: string, contractId: string, seasonYear: number, userId: string) {
  return await db.transaction(async (client) => {
    const contract = await ContractsRepository.getById(client, contractId, tenantId);
    if (!contract) throw new NotFoundError('Contract not found');
    if (!contract.package_services || !Array.isArray(contract.package_services)) {
      throw new BadRequestError('Contract has no package services defined');
    }

    const occurrences: OccurrenceInsert[] = [];

    for (const service of contract.package_services) {
      // SKIP weekly services (use V1 recurring job system)
      if (service.occurrence_type === 'weekly') continue;

      const count = service.occurrence_type === 'one_time' ? 1 : service.occurrence_count;
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
          is_included_in_invoice: contract.service_tier === 'bronze' ? true : false,
          notes: service.notes ?? null,
        });
      }
    }

    const insertedCount = await OccurrenceRepository.bulkInsert(client, occurrences);
    return { total_generated: occurrences.length, inserted: insertedCount };
  });
}

// Assign occurrence → create job
export async function assignOccurrence(
  tenantId: string, occurrenceId: string, assignedDate: string, notes: string | null, userId: string
) {
  return await db.transaction(async (client) => {
    const occ = await OccurrenceRepository.getById(tenantId, occurrenceId);
    if (!occ) throw new NotFoundError('Occurrence not found');
    if (occ.status !== 'pending') throw new BadRequestError('Only pending occurrences can be assigned');

    // Get total count for this service on this contract
    const totalCount = await OccurrenceRepository.countByContractService(
      tenantId, occ.contract_id, occ.service_code, occ.season_year
    );

    // Create job via Job Pipeline (D-23)
    const job = await JobsService.createJob(client, tenantId, {
      customer_id: occ.customer_id,
      property_id: occ.property_id,
      division: 'landscaping_maintenance',
      title: `${occ.service_name} — ${occ.occurrence_number}/${totalCount}`,
      creation_path: 'instant_work_order',
      scheduled_date: assignedDate,
    }, userId);

    // Update occurrence
    await OccurrenceRepository.update(client, occurrenceId, tenantId, {
      status: 'assigned',
      assigned_date: assignedDate,
      job_id: job.id,
      notes: notes,
    });

    return { job, occurrence_id: occurrenceId };
  });
}

// Bulk assign — create one job per occurrence
export async function bulkAssign(
  tenantId: string, occurrenceIds: string[], assignedDate: string, notes: string | null, userId: string
) {
  const results = [];
  for (const id of occurrenceIds) {
    const result = await assignOccurrence(tenantId, id, assignedDate, notes, userId);
    results.push(result);
  }
  return { jobs_created: results.length, occurrences_assigned: results.length };
}

// Skip occurrence
export async function skipOccurrence(
  tenantId: string, occurrenceId: string, input: SkipInput, userId: string
) {
  return await db.transaction(async (client) => {
    const occ = await OccurrenceRepository.getById(tenantId, occurrenceId);
    if (!occ) throw new NotFoundError('Occurrence not found');

    // Update occurrence → skipped
    await OccurrenceRepository.update(client, occurrenceId, tenantId, {
      status: 'skipped',
      skipped_reason: input.skipped_reason,
      skipped_date: input.skipped_date,
      recovery_date: input.recovery_date ?? null,
    });

    // If occurrence had a job → update job status to 'skipped'
    if (occ.job_id) {
      await JobsRepository.update(client, occ.job_id, tenantId, { status: 'skipped' });
      await DiaryRepository.insert(client, {
        tenant_id: tenantId,
        job_id: occ.job_id,
        entry_type: 'status_change',
        title: `Visit skipped — ${input.skipped_reason}`,
        is_system_entry: true,
      });
    }

    return { occurrence_id: occurrenceId, status: 'skipped' };
  });
}

// Mark occurrence as completed (called when job completes)
export async function markCompleted(tenantId: string, occurrenceId: string) {
  await OccurrenceRepository.update(db.pool, occurrenceId, tenantId, {
    status: 'completed',
  });
}
```

---

## Part C: Zod Schemas

### `schema.ts`

```typescript
export const generateOccurrencesSchema = z.object({
  season_year: z.coerce.number().int().min(2024).max(2030),
});

export const assignOccurrenceSchema = z.object({
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
});

export const bulkAssignSchema = z.object({
  occurrence_ids: z.array(z.string().uuid()).min(1).max(200),
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).optional(),
});

export const skipOccurrenceSchema = z.object({
  skipped_reason: z.string().min(1).max(255),
  skipped_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recovery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const occurrenceQuerySchema = z.object({
  season_year: z.coerce.number().int().optional(),
  service_code: z.string().optional(),
  status: z.enum(['pending', 'assigned', 'completed', 'skipped']).optional(),
  contract_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const serviceListQuerySchema = z.object({
  season_year: z.coerce.number().int().default(new Date().getFullYear()),
});

export const serviceDetailQuerySchema = z.object({
  occurrence_number: z.coerce.number().int().min(1),
  season_year: z.coerce.number().int().default(new Date().getFullYear()),
});
```

---

## Part D: API Endpoints

### `routes.ts`

```typescript
// Service Lists (coordinator operational view)
router.get('/v1/service-lists', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.getServiceListSummary);
router.get('/v1/service-lists/:serviceCode', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.getServiceDetail);

// Occurrences CRUD
router.get('/v1/service-occurrences', authenticate, tenantScope, ctrl.listOccurrences);
router.get('/v1/service-occurrences/season-summary', authenticate, tenantScope, ctrl.getSeasonSummary);
router.get('/v1/service-occurrences/:id', authenticate, tenantScope, ctrl.getOccurrence);

// Assignment
router.patch('/v1/service-occurrences/:id/assign', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(assignOccurrenceSchema), ctrl.assignOccurrence);
router.post('/v1/service-occurrences/bulk-assign', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(bulkAssignSchema), ctrl.bulkAssign);

// Skip / Complete
router.patch('/v1/service-occurrences/:id/skip', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(skipOccurrenceSchema), ctrl.skipOccurrence);
router.patch('/v1/service-occurrences/:id/complete', authenticate, tenantScope, ctrl.markCompleted);

// Season setup (generates occurrences from contract)
router.post('/v1/contracts/:contractId/season-setup', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(generateOccurrencesSchema), ctrl.generateOccurrences);
```

---

## Business Rules

1. **Weekly mowing** uses V1 recurring job system — NOT occurrences
2. **Season setup idempotent** — safe to re-run (ON CONFLICT DO NOTHING)
3. **Only pending** occurrences can be assigned
4. **Assigning always creates a job** — cannot assign without job creation
5. **Gold/Silver**: `is_included_in_invoice=FALSE` (operational tracking only, never on invoice)
6. **Bronze per-cut**: `is_included_in_invoice=TRUE` (billing engine counts completed occurrences)
7. **Skipped Gold/Silver** don't affect billing (flat monthly fee)
8. **Recovery dates** for bronze per-cut → included in next billing period

---

## Testing

Write tests for:
1. Occurrence generation from contract package_services
2. Idempotent re-generation (no duplicates)
3. Weekly services skipped (not in occurrences)
4. Assign occurrence creates job
5. Bulk assign creates multiple jobs
6. Skip occurrence updates status + job status
7. Service list summary aggregation
8. Season summary stats

## Done When
- [ ] Season setup generates occurrences from contract
- [ ] Idempotent generation
- [ ] Assign creates job via Job Pipeline
- [ ] Bulk assign works
- [ ] Skip with reason and recovery date
- [ ] Service list views (summary + detail)
- [ ] Season progress tracking
- [ ] All tests pass
- [ ] Committed to branch
