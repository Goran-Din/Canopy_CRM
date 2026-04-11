# Wave 2, Task 1: Job Pipeline V2 (D-23)

> **Branch:** `feature/wave2-job-pipeline`
> **Source docs:** D-23 (Job Pipeline & Job Card Module)
> **Dependencies:** Wave 1 complete (migrations 020-034)
> **Build order:** This is Wave 2's foundation — build FIRST

---

## Overview

Extend the existing V1 jobs module with V2 features: job numbers, creation paths, badges, diary logging, and photo management. Does NOT replace V1 job logic — it extends it.

## Files to Create/Modify

### Existing files to EXTEND (not replace):
```
api/src/modules/jobs/
├── controller.ts   ← Add V2 handlers (diary, photos, badges, status transitions)
├── service.ts      ← Add diary logging to ALL state changes, photo logic, badge logic
├── repository.ts   ← Add V2 queries (diary, photos, badges, job_number)
├── schema.ts       ← Add V2 Zod schemas
├── routes.ts       ← Add V2 route definitions
└── __tests__/      ← Add V2 tests
```

### New sub-modules to create:
```
api/src/modules/jobs/
├── diary/
│   ├── diary.repository.ts
│   ├── diary.service.ts
│   └── diary.schema.ts
├── photos/
│   ├── photos.repository.ts
│   ├── photos.service.ts
│   └── photos.schema.ts
└── badges/
    ├── badges.repository.ts
    ├── badges.service.ts
    └── badges.schema.ts
```

---

## Part A: Job Number Assignment

### Repository — add to `repository.ts`

```sql
-- Call the atomic next_job_number() function on job creation
SELECT next_job_number($1, $2) as job_number
-- $1 = tenant_id, $2 = season_year (extract from CURRENT_DATE)
```

### Service — modify `createJob()`

On every job creation:
1. Call `next_job_number(tenantId, currentYear)` to get job number
2. Set `creation_path` from input (validated by schema)
3. Insert job with job_number and creation_path
4. **Create diary entry** `'job_created'` in SAME transaction
5. Return job with job_number

```typescript
// Inside createJob service method — within transaction:
const jobNumber = await JobsRepository.getNextJobNumber(client, tenantId, currentYear);

const job = await JobsRepository.insert(client, {
  ...input,
  tenant_id: tenantId,
  job_number: jobNumber,
  creation_path: input.creation_path, // 'quote' | 'instant_work_order' | 'assessment'
  status: input.creation_path === 'instant_work_order' ? 'unscheduled'
        : input.creation_path === 'assessment' ? 'assessment'
        : 'quote',
});

// MANDATORY diary entry
await DiaryRepository.insert(client, {
  tenant_id: tenantId,
  job_id: job.id,
  entry_type: 'job_created',
  title: `Job #${jobNumber} created as ${formatCreationPath(input.creation_path)}`,
  metadata: { creation_path: input.creation_path, created_by: userId },
  created_by_user_id: userId,
  is_system_entry: false,
});
```

---

## Part B: Diary System (Append-Only)

### `diary.repository.ts`

```typescript
// Insert diary entry (append-only — no update, no delete)
export async function insert(client: PoolClient, entry: DiaryInsert): Promise<DiaryEntry> {
  const result = await client.query(
    `INSERT INTO job_diary_entries
     (tenant_id, job_id, entry_type, title, body, metadata,
      created_by_user_id, is_system_entry, northchat_thread_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [entry.tenant_id, entry.job_id, entry.entry_type, entry.title,
     entry.body ?? null, entry.metadata ? JSON.stringify(entry.metadata) : null,
     entry.created_by_user_id ?? null, entry.is_system_entry ?? true,
     entry.northchat_thread_id ?? null]
  );
  return result.rows[0];
}

// List diary entries (newest first, paginated)
export async function findByJobId(
  tenantId: string, jobId: string, page: number, limit: number
): Promise<{ rows: DiaryEntry[]; total: number }> {
  // WHERE tenant_id = $1 AND job_id = $2
  // ORDER BY created_at DESC
  // LIMIT $3 OFFSET $4
}
```

### `diary.schema.ts`

```typescript
export const addDiaryNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const diaryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entry_type: z.string().optional(),
});
```

### Mandatory Diary Events

**CRITICAL:** Every service method that changes job state MUST create a diary entry in the SAME database transaction. This is non-negotiable.

| Event | entry_type | Title Template |
|-------|-----------|----------------|
| Job created | `job_created` | `Job #NNNN-YY created as [path]` |
| Crew assigned | `crew_assigned` | `Assigned to [Crew Name] — [Date] [Time]` |
| Status changed | `status_change` | `Status changed: [from] → [to]` |
| Quote created | `quote_created` | `Quote draft created` |
| Quote sent | `quote_sent` | `Quote sent to [email] via [channel]` |
| Quote signed | `quote_signed` | `Quote signed by [signer_name]` |
| Quote expired | `quote_expired` | `Quote expired — valid until [date] passed` |
| Invoice created | `invoice_created` | `Invoice [number] created — $[amount]` |
| Invoice pushed | `invoice_pushed_xero` | `Invoice [number] pushed to Xero` |
| Invoice paid | `invoice_paid` | `Invoice [number] paid — $[amount] on [date]` |
| Photo uploaded | `photo_uploaded` | `Photo uploaded: [tag] — by [user name]` |
| Automation fired | `automation_fired` | `[Automation name] sent via [channel]` |
| NorthChat linked | `northchat_linked` | `NorthChat [channel] conversation linked` |
| Note added | `note_added` | `Note: [first 50 chars]` |
| Job converted | `job_converted` | `Converted from Assessment to Work Order` |

---

## Part C: Photo Management

### `photos.repository.ts`

```typescript
// Insert photo record (links to client_files via file_id)
export async function insert(client: PoolClient, photo: PhotoInsert): Promise<JobPhoto> {
  // INSERT INTO job_photos (tenant_id, job_id, property_id, file_id, photo_tag, ...)
}

// List photos by job (filterable by tag)
export async function findByJobId(
  tenantId: string, jobId: string, tag?: string
): Promise<JobPhoto[]> {
  // WHERE tenant_id=$1 AND job_id=$2 AND deleted_at IS NULL
  // AND (photo_tag = $3 OR $3 IS NULL)
  // ORDER BY created_at DESC
}

// Update photo metadata (tag, caption, portal_visible)
export async function update(/*...*/) { /* ... */ }

// Soft-delete
export async function softDelete(/*...*/) { /* ... */ }
```

### `photos.schema.ts`

```typescript
export const addPhotoSchema = z.object({
  file_id: z.string().uuid(),
  photo_tag: z.enum([
    'before_work', 'during_work', 'after_work',
    'issue_found', 'customer_signoff', 'property_overview'
  ]),
  caption: z.string().max(500).optional(),
  portal_visible: z.boolean().default(false),
  upload_source: z.enum(['crew_app', 'staff_web', 'client_portal', 'system']).default('staff_web'),
});

export const updatePhotoSchema = z.object({
  photo_tag: z.enum([...]).optional(),
  caption: z.string().max(500).optional(),
  portal_visible: z.boolean().optional(),
});
```

### Photo Business Rules
- All uploads require a `photo_tag` — no untagged photos
- `issue_found` tag: trigger auto-notification to coordinator (log in service layer)
- `after_work` tag: `portal_visible` defaults to `true` (staff can toggle)
- All other tags: `portal_visible` defaults to `false`
- Crew can upload; only coordinator+ can toggle `portal_visible`

---

## Part D: Badge System

### `badges.repository.ts`

```typescript
// Get all active badges for tenant
export async function findAll(tenantId: string): Promise<JobBadge[]> {
  // SELECT * FROM job_badges WHERE tenant_id=$1 AND is_active=TRUE
  // ORDER BY sort_order ASC
}

// Create/update badge
export async function upsert(/*...*/) { /* ... */ }
```

### Seed default badges (in service layer or migration seed)
| Name | Color | Icon |
|------|-------|------|
| VIP | `#7C3AED` | `crown` |
| Priority | `#DC2626` | `alert-triangle` |
| New Customer | `#059669` | `user-plus` |
| Hold | `#D97706` | `pause-circle` |
| Returning | `#2563EB` | `refresh-cw` |
| Referral | `#0891B2` | `share-2` |

---

## Part E: API Endpoints

Add to `routes.ts`:

```typescript
// V2 Job endpoints (add to existing jobs router)
router.post('/v1/jobs', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(createJobV2Schema), ctrl.createJob);
router.get('/v1/jobs', authenticate, tenantScope, ctrl.listJobs);
router.get('/v1/jobs/:id', authenticate, tenantScope, ctrl.getJob);
router.patch('/v1/jobs/:id', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(updateJobSchema), ctrl.updateJob);
router.post('/v1/jobs/:id/status', authenticate, tenantScope, validate(changeStatusSchema), ctrl.changeStatus);
router.post('/v1/jobs/:id/convert-to-wo', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.convertToWorkOrder);

// Diary
router.get('/v1/jobs/:id/diary', authenticate, tenantScope, ctrl.listDiaryEntries);
router.post('/v1/jobs/:id/diary', authenticate, tenantScope, validate(addDiaryNoteSchema), ctrl.addDiaryNote);

// Photos
router.get('/v1/jobs/:id/photos', authenticate, tenantScope, ctrl.listPhotos);
router.post('/v1/jobs/:id/photos', authenticate, tenantScope, validate(addPhotoSchema), ctrl.addPhoto);
router.patch('/v1/jobs/:id/photos/:photoId', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(updatePhotoSchema), ctrl.updatePhoto);
router.delete('/v1/jobs/:id/photos/:photoId', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.deletePhoto);
```

---

## Part F: Role-Based Access

| Action | owner | div_mgr | coordinator | crew_leader | crew_member | client |
|--------|-------|---------|-------------|-------------|-------------|--------|
| Create Job | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View List | ✓ All | ✓ Division | ✓ Division | ✓ Own | ✓ Own | ✗ |
| View Detail | ✓ | ✓ | ✓ | ✓ Own | ✓ Own | ✗ |
| Change Status | ✓ | ✓ | ✓ | ✓ Limited | ✓ Limited | ✗ |
| Add Diary Note | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Upload Photo | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Toggle portal_visible | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View Billing Tab | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## Testing

```bash
npm run test -w api
```

Write tests for:
1. Job creation with job_number generation
2. Diary entry auto-created on job creation
3. Diary entry auto-created on status change
4. Photo CRUD with tag validation
5. Badge listing and assignment
6. Role-based access for each endpoint
7. Convert assessment → work order flow

## Done When
- [ ] Job creation generates job_number via `next_job_number()`
- [ ] Every state change creates diary entry in same transaction
- [ ] Photo CRUD works with tag validation
- [ ] Badge system functional
- [ ] All V1 tests still pass
- [ ] New V2 tests pass
- [ ] Committed to branch
