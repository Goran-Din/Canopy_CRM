# Wave 2, Task 7: Property Knowledge Card Module (D-34)

> **Branch:** `feature/wave2-property-knowledge-card`
> **Source docs:** D-34 (Property Knowledge Card Module)
> **Dependencies:** Task 1 (Job Pipeline), Task 5 (Service Occurrences), Wave 1 migrations 027-028
> **Build order:** Can be built in parallel with Billing Engine or after it

---

## Overview

Extend the existing V1 properties module with V2 Property Knowledge Card features: category classification, measurements, access/crew info, service price history (auto-populated), estimation assistant, and crew field notes. Philosophy: capture institutional knowledge so any staff member has full property context.

## Files to Create/Modify

### Extend existing properties module:
```
api/src/modules/properties/
├── controller.ts    ← Add V2 handlers (knowledge card, estimation, crew notes)
├── service.ts       ← Add V2 service methods
├── repository.ts    ← Add V2 queries
├── schema.ts        ← Add V2 Zod schemas
└── routes.ts        ← Add V2 routes
```

### New sub-module:
```
api/src/modules/properties/
├── service-history/
│   ├── service-history.repository.ts
│   └── service-history.service.ts
└── __tests__/
```

---

## Part A: Property Profile Update

### Repository — add V2 column queries to `repository.ts`

```typescript
// Update property V2 fields
export async function updateProfile(
  client: PoolClient, tenantId: string, propertyId: string, updates: PropertyProfileUpdate
): Promise<Property> {
  // Dynamic UPDATE for any combination of V2 fields:
  // property_category, property_description, bed_area_sqft, num_bushes_shrubs, num_trees,
  // driveway_sqft, driveway_material, walkway_linear_ft, patio_sqft, parking_lot_sqft,
  // snow_service_active, snow_plow_area_sqft, snow_salting_area_sqft, snow_hand_shoveling_sqft,
  // entry_method, crew_parking, equipment_access, dogs_on_property, special_crew_instructions
  // WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL RETURNING *
}

// Get full knowledge card data (joined query)
export async function getKnowledgeCard(tenantId: string, propertyId: string): Promise<PropertyKnowledgeCard> {
  // SELECT p.*, c.display_name, c.customer_number,
  //   (SELECT json_agg(...) FROM service_contracts WHERE property_id=p.id AND status='active') as contracts,
  //   (SELECT COUNT(*) FROM jobs WHERE property_id=p.id AND deleted_at IS NULL) as total_jobs
  // FROM properties p
  // JOIN customers c ON p.customer_id = c.id
  // WHERE p.id=$1 AND p.tenant_id=$2 AND p.deleted_at IS NULL
}

// Category summary (count by category)
export async function getCategorySummary(tenantId: string): Promise<CategorySummary[]> {
  // SELECT property_category, COUNT(*) as count
  // FROM properties WHERE tenant_id=$1 AND deleted_at IS NULL AND property_category IS NOT NULL
  // GROUP BY property_category ORDER BY property_category
}
```

---

## Part B: Service Price History (Auto-Populated)

### `service-history.repository.ts`

```typescript
// Upsert service history (called by other modules — NOT manually)
export async function upsert(client: PoolClient, entry: ServiceHistoryUpsert): Promise<void> {
  await client.query(
    `INSERT INTO property_service_history
     (tenant_id, property_id, customer_id, contract_id, job_id,
      service_code, service_name, service_date, season_year, division, crew_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (property_id, service_code, season_year)
     DO UPDATE SET
       service_date = COALESCE(EXCLUDED.service_date, property_service_history.service_date),
       crew_id = COALESCE(EXCLUDED.crew_id, property_service_history.crew_id),
       job_id = COALESCE(EXCLUDED.job_id, property_service_history.job_id),
       status = COALESCE(EXCLUDED.status, property_service_history.status),
       notes = COALESCE(EXCLUDED.notes, property_service_history.notes),
       updated_at = NOW()`,
    [entry.tenant_id, entry.property_id, entry.customer_id, entry.contract_id, entry.job_id,
     entry.service_code, entry.service_name, entry.service_date, entry.season_year,
     entry.division, entry.crew_id, entry.status, entry.notes]
  );
}

// Get history for property (grouped by service, ordered by season year)
export async function findByPropertyId(
  tenantId: string, propertyId: string
): Promise<ServiceHistoryEntry[]> {
  // SELECT * FROM property_service_history
  // WHERE tenant_id=$1 AND property_id=$2
  // ORDER BY season_year DESC, service_code
}

// Get history for estimation context (specific service across years)
export async function findByPropertyService(
  tenantId: string, propertyId: string, serviceCode: string
): Promise<ServiceHistoryEntry[]> {
  // WHERE tenant_id=$1 AND property_id=$2 AND service_code=$3
  // ORDER BY season_year DESC
}

// Get similar property pricing (for estimation assistant)
export async function getSimilarPropertyPricing(
  tenantId: string, propertyCategory: string, serviceCode: string, seasonYear: number
): Promise<PricingStats> {
  const result = await queryDb(
    `SELECT
       COUNT(*) as count,
       MIN(psh.last_quoted_price) as price_range_min,
       MAX(psh.last_quoted_price) as price_range_max,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY psh.last_quoted_price) as price_median
     FROM property_service_history psh
     JOIN properties p ON psh.property_id = p.id
     WHERE psh.tenant_id = $1
       AND p.property_category = $2
       AND psh.service_code = $3
       AND psh.season_year = $4
       AND psh.last_quoted_price IS NOT NULL`,
    [tenantId, propertyCategory, serviceCode, seasonYear]
  );
  return result.rows[0];
}
```

### Auto-Population Triggers

Service history is populated by OTHER modules — never manually. Create hooks in:

```typescript
// In Quote Builder service (D-24) — after quote sent:
export async function updateHistoryFromQuote(quote: QuoteV2, tenantId: string) {
  for (const section of quote.sections) {
    for (const item of section.line_items) {
      if (!item.xero_item_id) continue; // Skip custom items
      await ServiceHistoryRepository.upsert(db.pool, {
        tenant_id: tenantId,
        property_id: quote.property_id,
        customer_id: quote.customer_id,
        service_code: item.xero_item_code,
        service_name: item.item_name,
        season_year: new Date().getFullYear(),
        last_quoted_price: item.unit_price,
        quote_id: quote.id,
      });
    }
  }
}

// In Job Pipeline service (D-23) — after job completed:
export async function updateHistoryFromJobCompletion(job: Job, tenantId: string) {
  // Update last_job_date for the service associated with this job
  // Called when job.status transitions to 'completed'
}

// In Billing Engine (D-29) — after invoice pushed to Xero:
export async function updateHistoryFromInvoice(invoice: Invoice, tenantId: string) {
  // Update last_invoiced_price
}
```

---

## Part C: Estimation Assistant

### `service.ts`

```typescript
// Get estimation context for Quote Builder
export async function getEstimationContext(
  tenantId: string, propertyId: string, serviceCode: string
) {
  const property = await PropertiesRepository.getById(tenantId, propertyId);
  if (!property) throw new NotFoundError('Property not found');

  // Service history at this property
  const history = await ServiceHistoryRepository.findByPropertyService(
    tenantId, propertyId, serviceCode
  );

  // Similar property pricing (same category)
  const currentYear = new Date().getFullYear();
  const similarPricing = property.property_category
    ? await ServiceHistoryRepository.getSimilarPropertyPricing(
        tenantId, property.property_category, serviceCode, currentYear
      )
    : null;

  // Suggested price (last year + 3.5% inflation)
  const lastYearHistory = history.find(h => h.season_year === currentYear - 1);
  const suggestedPrice = lastYearHistory?.last_quoted_price
    ? Math.round(Number(lastYearHistory.last_quoted_price) * 1.035 * 100) / 100
    : null;

  return {
    property: {
      address: `${property.street_address}, ${property.city} ${property.state}`,
      category: property.property_category,
      bed_area_sqft: property.bed_area_sqft,
      num_bushes_shrubs: property.num_bushes_shrubs,
      num_trees: property.num_trees,
    },
    service_history: {
      history_by_year: history.map(h => ({
        season_year: h.season_year,
        last_quoted_price: h.last_quoted_price,
        last_invoiced_price: h.last_invoiced_price,
        last_job_date: h.last_job_date,
        crew_time_minutes: h.crew_time_minutes,
        crew_notes: h.crew_notes,
      })),
    },
    similar_properties: similarPricing,
    suggested_price: suggestedPrice,
    suggestion_basis: suggestedPrice
      ? `Last year: $${lastYearHistory.last_quoted_price} + 3.5% inflation = $${suggestedPrice}`
      : null,
  };
}
```

**Rule:** Suggested price is HINT ONLY — coordinator always enters final price manually (Quote Builder D-24 rule).

---

## Part D: Crew Field Notes

```typescript
// Repository
export async function insertCrewNote(client: PoolClient, note: CrewNoteInsert): Promise<CrewNote> {
  // Append-only — stored in job_diary_entries with entry_type='crew_field_note'
  // OR create dedicated crew_notes on property_service_history
  // Linked to property_id, created_by crew member
}

export async function findCrewNotesByPropertyId(
  tenantId: string, propertyId: string
): Promise<CrewNote[]> {
  // Chronological list, newest first
  // WHERE tenant_id=$1 AND property_id=$2
  // ORDER BY created_at DESC
}
```

**Rule:** Crew notes are append-only — cannot be deleted. Permanent field record.

---

## Part E: Zod Schemas

### `schema.ts`

```typescript
export const updatePropertyProfileSchema = z.object({
  property_category: z.enum([
    'RES-S', 'RES-M', 'RES-L', 'COM-S', 'COM-M', 'COM-L',
    'HOA-S', 'HOA-M', 'HOA-L', 'PORT-R', 'PORT-C'
  ]).optional(),
  property_description: z.string().max(10000).optional(),
  bed_area_sqft: z.coerce.number().int().min(0).optional(),
  num_bushes_shrubs: z.coerce.number().int().min(0).optional(),
  num_trees: z.coerce.number().int().min(0).optional(),
  driveway_sqft: z.coerce.number().int().min(0).optional(),
  driveway_material: z.enum(['asphalt', 'concrete', 'pavers', 'gravel', 'other']).optional(),
  walkway_linear_ft: z.coerce.number().int().min(0).optional(),
  patio_sqft: z.coerce.number().int().min(0).optional(),
  parking_lot_sqft: z.coerce.number().int().min(0).optional(),
  snow_service_active: z.boolean().optional(),
  snow_plow_area_sqft: z.coerce.number().int().min(0).optional(),
  snow_salting_area_sqft: z.coerce.number().int().min(0).optional(),
  snow_hand_shoveling_sqft: z.coerce.number().int().min(0).optional(),
  entry_method: z.enum(['street_access', 'side_gate', 'back_gate', 'key_required', 'code_required', 'call_client', 'other']).optional(),
  crew_parking: z.enum(['available_street', 'available_driveway', 'restricted', 'call_first']).optional(),
  equipment_access: z.enum(['full_access', 'tight_access', 'hand_tools_only', 'assess_on_arrival']).optional(),
  dogs_on_property: z.enum(['no', 'yes', 'sometimes', 'unknown']).optional(),
  special_crew_instructions: z.string().max(5000).optional(),
});

export const estimationQuerySchema = z.object({
  service_code: z.string().min(1),
});

export const addCrewNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});
```

---

## Part F: API Endpoints

### `routes.ts` — add to existing properties router

```typescript
// Knowledge Card
router.get('/v1/properties/:id/knowledge-card', authenticate, tenantScope, ctrl.getKnowledgeCard);
router.patch('/v1/properties/:id/profile', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), validate(updatePropertyProfileSchema), ctrl.updateProfile);

// Service History
router.get('/v1/properties/:id/service-history', authenticate, tenantScope, ctrl.getServiceHistory);

// Estimation Assistant
router.get('/v1/properties/:id/estimation-context', authenticate, tenantScope, requireRole('owner', 'div_mgr', 'coordinator'), ctrl.getEstimationContext);

// Crew Notes
router.get('/v1/properties/:id/crew-notes', authenticate, tenantScope, ctrl.getCrewNotes);
router.post('/v1/properties/:id/crew-notes', authenticate, tenantScope, validate(addCrewNoteSchema), ctrl.addCrewNote);

// Property Photos
router.get('/v1/properties/:id/photos', authenticate, tenantScope, ctrl.getPropertyPhotos);

// Job History
router.get('/v1/properties/:id/job-history', authenticate, tenantScope, ctrl.getJobHistory);

// Category Summary
router.get('/v1/properties/categories/summary', authenticate, tenantScope, ctrl.getCategorySummary);
```

---

## Business Rules

1. **property_category** set manually — never auto-computed
2. **Service price history** auto-populated only — coordinators cannot edit history records
3. **Crew field notes** append-only — cannot be deleted (permanent field record)
4. **Estimation assistant** suggested price is hint only — final price always manual
5. **gate_code** display follows V1 rules — NEVER in portal responses
6. **special_crew_instructions** shown on crew mobile PWA — NEVER in portal

---

## Testing

Write tests for:
1. Property profile update (V2 fields)
2. Knowledge card data assembly
3. Service history upsert (idempotent)
4. Estimation context with historical pricing
5. Similar property pricing query
6. Crew notes (append-only, no delete)
7. Category summary aggregation
8. Portal filtering (no gate_code, no special_crew_instructions)

## Done When
- [ ] Property profile update with V2 fields
- [ ] Knowledge card endpoint assembles all data
- [ ] Service history auto-population hooks in other modules
- [ ] Estimation assistant with suggested pricing
- [ ] Crew notes (append-only)
- [ ] Category summary
- [ ] All tests pass
- [ ] Committed to branch
