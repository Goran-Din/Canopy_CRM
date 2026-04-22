import type { Express } from 'express';
import type { Mock } from 'vitest';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';

// ============================================
// IDs (used across all workflow test files)
// ============================================

export const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
export const USER_OWNER = 'cccccccc-0000-0000-0000-000000000001';
export const USER_COORDINATOR = 'cccccccc-0000-0000-0000-000000000002';
export const USER_CREW = 'cccccccc-0000-0000-0000-000000000003';
export const CUSTOMER_ID = 'dddddddd-0000-0000-0000-000000000001';
export const PROPERTY_ID = 'eeeeeeee-0000-0000-0000-000000000001';
export const CREW_ID = 'ffffffff-0000-0000-0000-000000000001';
export const JOB_ID = '33333333-0000-0000-0000-000000000001';
export const QUOTE_ID = 'aaaa1111-0000-0000-0000-000000000001';
export const SECTION_ID = 'bbbb1111-0000-0000-0000-000000000001';
export const LINE_ITEM_ID = 'cccc1111-0000-0000-0000-000000000001';
export const FILE_ID = 'ffffffff-0000-0000-0000-00000000ffff';

export const TEST_PASSWORD = 'TestPass123';

// A deterministic 64-hex signing token used when we want predictable behaviour.
export const SIGNING_TOKEN_FIXED = 'a'.repeat(64);

export const FAKE_SIGNATURE_BASE64 = (
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk' +
  'YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
).padEnd(400, 'A');

// ============================================
// Row shapes (minimal — only what workflow tests read)
// ============================================

export interface JobRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  contract_id: string | null;
  division: string;
  job_type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  estimated_duration_minutes: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  actual_duration_minutes: number | null;
  assigned_crew_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  completion_notes: string | null;
  requires_photos: boolean;
  invoice_id: string | null;
  weather_condition: string | null;
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  job_number: string | null;
  creation_path: string | null;
  badge_ids: string[];
  customer_display_name?: string | null;
  property_name?: string | null;
  contract_title?: string | null;
  photos?: unknown[];
  checklist?: unknown[];
}

export interface QuoteRow {
  id: string;
  tenant_id: string;
  job_id: string;
  quote_number: string;
  version: number;
  status: string;
  subtotal: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  client_notes: string | null;
  payment_terms: string | null;
  internal_notes: string | null;
  template_id: string | null;
  sent_via: string | null;
  sent_to_email: string | null;
  sent_to_phone: string | null;
  sent_at: Date | null;
  signing_token: string | null;
  valid_until: string | null;
  pdf_file_id: string | null;
  signed_pdf_file_id: string | null;
  decline_reason?: string | null;
  declined_at?: Date | null;
  created_by: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  sections?: QuoteSectionRow[];
  // join-style fields used by signing flow
  customer_id?: string;
  property_id?: string;
  customer_name?: string;
  customer_email?: string;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

export interface QuoteSectionRow {
  id: string;
  tenant_id: string;
  quote_id: string;
  section_title: string;
  section_body: string | null;
  sort_order: number;
  line_items?: QuoteLineItemRow[];
  created_at: Date;
  updated_at: Date;
}

export interface QuoteLineItemRow {
  id: string;
  tenant_id: string;
  quote_id: string;
  section_id: string;
  xero_item_id: string | null;
  xero_item_code: string | null;
  item_name: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unit_price: string;
  line_total: string;
  is_taxable: boolean;
  sort_order: number;
  is_locked: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DiaryEntry {
  id: string;
  tenant_id: string;
  job_id: string;
  entry_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_by_user_id: string | null;
  is_system_entry: boolean;
  created_at: string;
}

export interface SignatureRow {
  id: string;
  tenant_id: string;
  quote_id: string;
  signer_name: string;
  signature_file_id: string;
  signed_at: Date;
  signer_ip_address: string;
  user_agent: string;
  signing_token_used: string;
  agreement_checked: boolean;
  created_at: Date;
}

export interface ContractRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  contract_type: string;
  status: string;
  division: string;
  contract_number: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  billing_frequency: string;
  contract_value: number | null;
  recurring_amount: number | null;
  auto_renew: boolean;
  service_tier?: string | null;
  season_year_active?: number | null;
  season_start_date?: string | null;
  season_monthly_price?: number | null;
  per_cut_price?: number | null;
  bronze_billing_type?: string | null;
  package_services?: Array<{
    service_code: string;
    service_name: string;
    occurrence_type: string;
    occurrence_count?: number;
    preferred_months?: string[];
    notes?: string;
  }>;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface OccurrenceRow {
  id: string;
  tenant_id: string;
  contract_id: string;
  property_id: string;
  customer_id: string;
  service_code: string;
  service_name: string;
  occurrence_number: number;
  season_year: number;
  status: string;
  assigned_date: string | null;
  preferred_month: string | null;
  job_id: string | null;
  skipped_reason: string | null;
  skipped_date: string | null;
  recovery_date: string | null;
  is_included_in_invoice: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BillingScheduleRow {
  id: string;
  tenant_id: string;
  contract_id: string;
  billing_period_start: Date;
  billing_period_end: Date;
  billing_date: Date;
  invoice_number_in_season: number;
  total_invoices_in_season: number;
  planned_amount: number | null;
  status: string; // scheduled | draft | approved | skipped
  invoice_draft_id?: string | null;
}

export interface InvoiceDraftRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  contract_id: string | null;
  billing_schedule_id: string | null;
  line_items: Array<Record<string, unknown>>;
  subtotal: number;
  total_amount: number;
  description: string | null;
  status: string; // pending_review | reviewed | approved | rejected | pushed_to_xero
  approved_by?: string | null;
  approved_at?: Date | null;
  rejection_reason?: string | null;
  created_at: Date;
}

export interface MilestoneRow {
  id: string;
  tenant_id: string;
  job_id: string;
  contract_id: string | null;
  customer_id: string;
  milestone_name: string;
  milestone_description: string | null;
  amount_type: 'fixed' | 'percentage';
  amount_value: number;
  computed_amount: number | null;
  project_total: number | null;
  sort_order: number;
  due_date: string | null;
  status: string; // pending | invoiced | approved | paid | cancelled
  triggered_at?: Date | null;
  paid_at?: Date | null;
  created_at: Date;
}

// ============================================
// WorkflowState — simulates a single tenant's DB during one workflow
// ============================================

export class WorkflowState {
  jobs = new Map<string, JobRow>();
  quotes = new Map<string, QuoteRow>();
  signatures: SignatureRow[] = [];
  diary: DiaryEntry[] = [];
  invoices: Array<{ id: string; invoice_number: string; status: string; paid_at?: string }> = [];
  contracts = new Map<string, ContractRow>();
  occurrences = new Map<string, OccurrenceRow>();
  billingSchedule = new Map<string, BillingScheduleRow>();
  invoiceDrafts = new Map<string, InvoiceDraftRow>();
  milestones = new Map<string, MilestoneRow>();

  // Mock side-effect observers
  automationCalls: Array<{ fn: string; tenantId: string; jobId: string }> = [];
  mauticCalls: Array<{ fn: string; tenantId: string; quoteId: string }> = [];
  canopyQuotesCalls: Array<{ tenantId: string; jobId: string; status: string }> = [];

  // Counters
  private jobSeq = 0;
  private quoteSeq = 0;

  reset(): void {
    this.jobs.clear();
    this.quotes.clear();
    this.signatures.length = 0;
    this.diary.length = 0;
    this.invoices.length = 0;
    this.contracts.clear();
    this.occurrences.clear();
    this.billingSchedule.clear();
    this.invoiceDrafts.clear();
    this.milestones.clear();
    this.automationCalls.length = 0;
    this.mauticCalls.length = 0;
    this.canopyQuotesCalls.length = 0;
    this.jobSeq = 0;
    this.quoteSeq = 0;
  }

  nextJobNumber(year: number): string {
    this.jobSeq += 1;
    const shortYear = String(year).slice(-2);
    return `${String(this.jobSeq).padStart(4, '0')}-${shortYear}`;
  }

  nextQuoteNumber(): string {
    this.quoteSeq += 1;
    const shortYear = String(new Date().getFullYear()).slice(-2);
    return `Q-${String(this.quoteSeq).padStart(4, '0')}-${shortYear}`;
  }

  diaryTitles(jobId?: string): string[] {
    return this.diary
      .filter((d) => !jobId || d.job_id === jobId)
      .map((d) => d.title);
  }

  diaryEntryTypes(jobId?: string): string[] {
    return this.diary
      .filter((d) => !jobId || d.job_id === jobId)
      .map((d) => d.entry_type);
  }
}

// ============================================
// Fixture builders
// ============================================

export function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  const now = new Date().toISOString();
  return {
    id: JOB_ID,
    tenant_id: TENANT_A,
    customer_id: CUSTOMER_ID,
    property_id: PROPERTY_ID,
    contract_id: null,
    division: 'landscaping_maintenance',
    job_type: 'scheduled_service',
    status: 'quote',
    priority: 'normal',
    title: 'Test Job',
    description: null,
    scheduled_date: null,
    scheduled_start_time: null,
    estimated_duration_minutes: null,
    actual_start_time: null,
    actual_end_time: null,
    actual_duration_minutes: null,
    assigned_crew_id: null,
    assigned_to: null,
    notes: null,
    completion_notes: null,
    requires_photos: false,
    invoice_id: null,
    weather_condition: null,
    tags: [],
    created_by: USER_OWNER,
    updated_by: USER_OWNER,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    job_number: '0001-26',
    creation_path: 'quote',
    badge_ids: [],
    customer_display_name: 'Jane Smith',
    property_name: 'Front Yard',
    contract_title: null,
    photos: [],
    checklist: [],
    ...overrides,
  };
}

export const CONTRACT_ID = 'c0ffee00-0000-0000-0000-000000000001';

export function makeContract(overrides: Partial<ContractRow> = {}): ContractRow {
  const now = new Date();
  return {
    id: CONTRACT_ID,
    tenant_id: TENANT_A,
    customer_id: CUSTOMER_ID,
    property_id: PROPERTY_ID,
    contract_type: 'recurring',
    status: 'active',
    division: 'landscaping_maintenance',
    contract_number: 'CTR-0001-26',
    title: 'Gold Season 2026',
    description: null,
    start_date: '2026-04-01',
    end_date: '2026-11-30',
    billing_frequency: 'monthly',
    contract_value: 8000,
    recurring_amount: 1000,
    auto_renew: true,
    service_tier: 'gold',
    season_year_active: 2025, // last year's season — wizard should see this as "pending"
    season_start_date: '2026-04-01',
    season_monthly_price: 1000,
    per_cut_price: null,
    bronze_billing_type: null,
    package_services: [
      { service_code: 'FERT', service_name: 'Fertilization', occurrence_type: 'per_season', occurrence_count: 5 },
      { service_code: 'AERATE', service_name: 'Core Aeration', occurrence_type: 'one_time' },
      { service_code: 'MOW', service_name: 'Weekly Mowing', occurrence_type: 'weekly' }, // skipped by setup
    ],
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

export function makeOccurrence(overrides: Partial<OccurrenceRow> = {}): OccurrenceRow {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    tenant_id: TENANT_A,
    contract_id: CONTRACT_ID,
    property_id: PROPERTY_ID,
    customer_id: CUSTOMER_ID,
    service_code: 'FERT',
    service_name: 'Fertilization',
    occurrence_number: 1,
    season_year: 2026,
    status: 'pending',
    assigned_date: null,
    preferred_month: null,
    job_id: null,
    skipped_reason: null,
    skipped_date: null,
    recovery_date: null,
    is_included_in_invoice: false,
    notes: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeQuote(overrides: Partial<QuoteRow> = {}): QuoteRow {
  const now = new Date();
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: QUOTE_ID,
    tenant_id: TENANT_A,
    job_id: JOB_ID,
    quote_number: 'Q-0001-26',
    version: 1,
    status: 'draft',
    subtotal: '350.00',
    discount_amount: '0.00',
    tax_rate: '0.13',
    tax_amount: '45.50',
    total_amount: '395.50',
    client_notes: null,
    payment_terms: null,
    internal_notes: null,
    template_id: null,
    sent_via: null,
    sent_to_email: null,
    sent_to_phone: null,
    sent_at: null,
    signing_token: null,
    valid_until: validUntil,
    pdf_file_id: null,
    signed_pdf_file_id: null,
    created_by: USER_OWNER,
    updated_by: null,
    created_at: now,
    updated_at: now,
    customer_id: CUSTOMER_ID,
    property_id: PROPERTY_ID,
    customer_name: 'Jane Smith',
    customer_email: 'jane@example.com',
    street_address: '123 Main St',
    city: 'Toronto',
    state: 'ON',
    zip_code: 'M5V 1A1',
    sections: [
      {
        id: SECTION_ID,
        tenant_id: TENANT_A,
        quote_id: QUOTE_ID,
        section_title: 'Labour',
        section_body: null,
        sort_order: 0,
        created_at: now,
        updated_at: now,
        line_items: [
          {
            id: LINE_ITEM_ID,
            tenant_id: TENANT_A,
            quote_id: QUOTE_ID,
            section_id: SECTION_ID,
            xero_item_id: null,
            xero_item_code: null,
            item_name: 'Maintenance',
            description: null,
            quantity: '1',
            unit: 'each',
            unit_price: '350.00',
            line_total: '350.00',
            is_taxable: true,
            sort_order: 0,
            is_locked: false,
            created_at: now,
            updated_at: now,
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ============================================
// Mocks bag — shape that each test file assembles after vi.mock()
// ============================================

/**
 * Each test file defines its own vi.mock() blocks (hoisted at parse time)
 * and then passes the created mock functions here so this helper can wire
 * them against the shared WorkflowState.
 */
export interface WorkflowMocks {
  // auth repo
  findUserByEmail: Mock;
  findUserRoles: Mock;
  saveRefreshToken: Mock;
  updateLastLogin: Mock;

  // jobs repo
  jobsCustomerExists: Mock;
  jobsPropertyBelongsToCustomer: Mock;
  jobsContractExists: Mock;
  jobsGetNextJobNumber: Mock;
  jobsCreateWithClient: Mock;
  jobsFindById: Mock;
  jobsUpdate: Mock;
  jobsUpdateStatusWithClient: Mock;
  jobsAcquireClient: Mock;

  // jobs diary repo
  diaryInsert: Mock;
  diaryInsertStandalone: Mock;
  diaryFindByJobId: Mock;

  // quotes repo
  quotesGetById: Mock;
  quotesFindActiveByJobId: Mock;
  quotesFindByJobId: Mock;
  quotesGetNextQuoteNumber: Mock;
  quotesInsert: Mock;
  quotesUpdate: Mock;
  quotesUpdateStatus: Mock;
  quotesAcquireClient: Mock;

  // signatures repo
  signaturesFindBySigningToken: Mock;
  signaturesLockQuoteByToken: Mock;
  signaturesInsertSignature: Mock;
  signaturesFindByQuoteId: Mock;
  signaturesAcquireClient: Mock;

  // files repo
  filesInsertFile: Mock;

  // automation service
  automationHandleJobScheduled: Mock;

  // quote PDF service (to skip Puppeteer)
  pdfGenerateBuffer: Mock;
  pdfUploadQuotePdf: Mock;

  // R2 client
  r2UploadBuffer: Mock;
}

/**
 * Wire every mock to read/write against the WorkflowState.
 * Call this in beforeEach *after* state.reset().
 */
export function installStateMocks(state: WorkflowState, mocks: WorkflowMocks): void {
  // --- jobs: existence checks always pass ---
  mocks.jobsCustomerExists.mockResolvedValue(true);
  mocks.jobsPropertyBelongsToCustomer.mockResolvedValue(true);
  mocks.jobsContractExists.mockResolvedValue(true);

  // --- jobs: sequence + create ---
  mocks.jobsGetNextJobNumber.mockImplementation(
    async (_client: unknown, _tenantId: string, year: number) => state.nextJobNumber(year),
  );

  mocks.jobsCreateWithClient.mockImplementation(
    async (
      _client: unknown,
      tenantId: string,
      input: Record<string, unknown>,
      userId: string,
    ): Promise<JobRow> => {
      const id = crypto.randomUUID();
      const job = makeJob({
        id,
        tenant_id: tenantId,
        customer_id: input.customer_id as string,
        property_id: input.property_id as string,
        contract_id: (input.contract_id as string | null) ?? null,
        division: input.division as string,
        job_type: (input.job_type as string) ?? 'scheduled_service',
        status: input.status as string,
        priority: (input.priority as string) ?? 'normal',
        title: input.title as string,
        description: (input.description as string | null) ?? null,
        scheduled_date: (input.scheduled_date as string | null) ?? null,
        scheduled_start_time: (input.scheduled_start_time as string | null) ?? null,
        estimated_duration_minutes: (input.estimated_duration_minutes as number | null) ?? null,
        assigned_crew_id: (input.assigned_crew_id as string | null) ?? null,
        assigned_to: (input.assigned_to as string | null) ?? null,
        notes: (input.notes as string | null) ?? null,
        requires_photos: (input.requires_photos as boolean) ?? false,
        weather_condition: (input.weather_condition as string | null) ?? null,
        tags: (input.tags as string[]) ?? [],
        created_by: userId,
        updated_by: userId,
        job_number: (input.job_number as string) ?? null,
        creation_path: (input.creation_path as string) ?? null,
      });
      state.jobs.set(id, job);
      return job;
    },
  );

  mocks.jobsFindById.mockImplementation(
    async (_tenantId: string, id: string): Promise<JobRow | null> => {
      return state.jobs.get(id) ?? null;
    },
  );

  mocks.jobsUpdate.mockImplementation(
    async (
      tenantId: string,
      id: string,
      input: Record<string, unknown>,
      userId: string,
    ): Promise<JobRow | null> => {
      const existing = state.jobs.get(id);
      if (!existing || existing.tenant_id !== tenantId) return null;
      const updated = {
        ...existing,
        ...input,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as JobRow;
      state.jobs.set(id, updated);
      return updated;
    },
  );

  mocks.jobsUpdateStatusWithClient.mockImplementation(
    async (
      _client: unknown,
      tenantId: string,
      id: string,
      status: string,
      completion_notes: string | null,
      userId: string,
      extra?: Record<string, unknown>,
    ): Promise<JobRow | null> => {
      const existing = state.jobs.get(id);
      if (!existing || existing.tenant_id !== tenantId) return null;
      const updated: JobRow = {
        ...existing,
        status,
        completion_notes: completion_notes ?? existing.completion_notes,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        ...(extra ?? {}),
      };
      state.jobs.set(id, updated);
      return updated;
    },
  );

  // --- jobs: client acquisition is just a stub we observe ---
  // The fake client's query() handles a few SQL patterns that workflow services
  // execute directly (bypassing the repository layer) so tests can observe state.
  const fakeClient = {
    query: async (sql: string, _params?: unknown[]) => {
      const s = typeof sql === 'string' ? sql : '';
      // Quote → invoice conversion: INSERT INTO invoices returns a row the service
      // dereferences. Produce a stable-ish fake to unblock the response.
      if (/INSERT\s+INTO\s+invoices\b/i.test(s)) {
        const id = crypto.randomUUID();
        state.invoices.push({ id, invoice_number: `INV-${state.invoices.length + 1}`, status: 'draft' });
        return { rows: [{ id, invoice_number: `INV-${state.invoices.length}` }] };
      }
      // SELECT customer_id/property_id FROM jobs WHERE id = $1 (used in convert path)
      if (/SELECT\s+customer_id\s+FROM\s+jobs/i.test(s)) {
        return { rows: [{ customer_id: CUSTOMER_ID }] };
      }
      if (/SELECT\s+property_id\s+FROM\s+jobs/i.test(s)) {
        return { rows: [{ property_id: PROPERTY_ID }] };
      }
      // Fallback
      return { rows: [] };
    },
    release: () => {},
  };
  mocks.jobsAcquireClient.mockResolvedValue(fakeClient);

  // --- diary: append to state.diary ---
  const diaryInsertImpl = async (
    _clientOrRow: unknown,
    row?: Record<string, unknown>,
  ): Promise<DiaryEntry> => {
    const actualRow = (row ?? _clientOrRow) as unknown as Record<string, unknown>;
    const entry: DiaryEntry = {
      id: crypto.randomUUID(),
      tenant_id: actualRow.tenant_id as string,
      job_id: actualRow.job_id as string,
      entry_type: actualRow.entry_type as string,
      title: actualRow.title as string,
      body: (actualRow.body as string | null) ?? null,
      metadata: (actualRow.metadata as unknown as Record<string, unknown> | null) ?? null,
      created_by_user_id: (actualRow.created_by_user_id as string | null) ?? null,
      is_system_entry: (actualRow.is_system_entry as boolean) ?? false,
      created_at: new Date().toISOString(),
    };
    state.diary.push(entry);
    return entry;
  };
  mocks.diaryInsert.mockImplementation(diaryInsertImpl);
  mocks.diaryInsertStandalone.mockImplementation((row: Record<string, unknown>) =>
    diaryInsertImpl(null, row),
  );
  mocks.diaryFindByJobId.mockImplementation(async (_tenant: string, jobId: string) => ({
    rows: state.diary.filter((d) => d.job_id === jobId),
    total: state.diary.filter((d) => d.job_id === jobId).length,
  }));

  // --- quotes ---
  mocks.quotesAcquireClient.mockResolvedValue(fakeClient);
  mocks.quotesFindActiveByJobId.mockImplementation(async (tenantId: string, jobId: string) => {
    for (const q of state.quotes.values()) {
      if (q.tenant_id === tenantId && q.job_id === jobId && q.status === 'draft') return q;
    }
    return null;
  });
  mocks.quotesFindByJobId.mockImplementation(async (tenantId: string, jobId: string) => {
    return [...state.quotes.values()].filter(
      (q) => q.tenant_id === tenantId && q.job_id === jobId,
    );
  });
  mocks.quotesGetNextQuoteNumber.mockImplementation(async () => state.nextQuoteNumber());
  mocks.quotesInsert.mockImplementation(
    async (_client: unknown, row: Record<string, unknown>): Promise<QuoteRow> => {
      const id = crypto.randomUUID();
      // Fresh section/line item IDs per quote so multiple quotes don't collide.
      const sectionId = crypto.randomUUID();
      const lineItemId = crypto.randomUUID();
      const now = new Date();
      const quote = makeQuote({
        id,
        tenant_id: row.tenant_id as string,
        job_id: row.job_id as string,
        quote_number: row.quote_number as string,
        version: (row.version as number) ?? 1,
        status: (row.status as string) ?? 'draft',
        client_notes: (row.client_notes as string | null) ?? null,
        payment_terms: (row.payment_terms as string | null) ?? null,
        internal_notes: (row.internal_notes as string | null) ?? null,
        tax_rate: String(row.tax_rate ?? 0),
        discount_amount: String(row.discount_amount ?? 0),
        valid_until:
          row.valid_until instanceof Date
            ? row.valid_until.toISOString()
            : ((row.valid_until as string | null) ?? null),
        signing_token: (row.signing_token as string | null) ?? null,
        created_by: row.created_by as string,
        sections: [
          {
            id: sectionId,
            tenant_id: row.tenant_id as string,
            quote_id: id,
            section_title: 'Labour',
            section_body: null,
            sort_order: 0,
            created_at: now,
            updated_at: now,
            line_items: [
              {
                id: lineItemId,
                tenant_id: row.tenant_id as string,
                quote_id: id,
                section_id: sectionId,
                xero_item_id: null,
                xero_item_code: null,
                item_name: 'Maintenance',
                description: null,
                quantity: '1',
                unit: 'each',
                unit_price: '350.00',
                line_total: '350.00',
                is_taxable: true,
                sort_order: 0,
                is_locked: false,
                created_at: now,
                updated_at: now,
              },
            ],
          },
        ],
      });
      state.quotes.set(id, quote);
      return quote;
    },
  );
  mocks.quotesGetById.mockImplementation(async (tenantId: string, quoteId: string) => {
    const q = state.quotes.get(quoteId);
    if (!q || q.tenant_id !== tenantId) return null;
    return q;
  });
  mocks.quotesUpdate.mockImplementation(
    async (
      _client: unknown,
      quoteId: string,
      data: Record<string, unknown>,
    ): Promise<QuoteRow> => {
      const existing = state.quotes.get(quoteId);
      if (!existing) throw new Error(`Quote ${quoteId} not found in state`);
      const patched: QuoteRow = { ...existing };
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) {
          (patched as unknown as Record<string, unknown>)[k] = v;
        }
      }
      patched.updated_at = new Date();
      state.quotes.set(quoteId, patched);
      return patched;
    },
  );
  mocks.quotesUpdateStatus.mockImplementation(
    async (_client: unknown, quoteId: string, status: string) => {
      const existing = state.quotes.get(quoteId);
      if (!existing) return;
      state.quotes.set(quoteId, { ...existing, status, updated_at: new Date() });
    },
  );

  // --- signatures ---
  mocks.signaturesAcquireClient.mockResolvedValue(fakeClient);
  mocks.signaturesFindBySigningToken.mockImplementation(async (token: string) => {
    for (const q of state.quotes.values()) {
      if (q.signing_token === token) return q;
    }
    return null;
  });
  mocks.signaturesLockQuoteByToken.mockImplementation(
    async (_client: unknown, token: string) => {
      for (const q of state.quotes.values()) {
        if (q.signing_token === token) return q;
      }
      return null;
    },
  );
  mocks.signaturesInsertSignature.mockImplementation(
    async (_client: unknown, sig: Record<string, unknown>): Promise<SignatureRow> => {
      const row: SignatureRow = {
        id: crypto.randomUUID(),
        tenant_id: sig.tenant_id as string,
        quote_id: sig.quote_id as string,
        signer_name: sig.signer_name as string,
        signature_file_id: sig.signature_file_id as string,
        signed_at: (sig.signed_at as Date) ?? new Date(),
        signer_ip_address: sig.signer_ip_address as string,
        user_agent: (sig.user_agent as string) ?? '',
        signing_token_used: sig.signing_token_used as string,
        agreement_checked: sig.agreement_checked as boolean,
        created_at: new Date(),
      };
      state.signatures.push(row);
      return row;
    },
  );
  mocks.signaturesFindByQuoteId.mockImplementation(
    async (tenantId: string, quoteId: string) =>
      state.signatures.find((s) => s.tenant_id === tenantId && s.quote_id === quoteId) ?? null,
  );

  // --- files ---
  mocks.filesInsertFile.mockImplementation(
    async (_client: unknown, row: Record<string, unknown>) => ({
      id: FILE_ID,
      tenant_id: row.tenant_id as string,
      r2_key: row.r2_key as string,
    }),
  );

  // --- automation ---
  mocks.automationHandleJobScheduled.mockImplementation(
    async (tenantId: string, jobId: string) => {
      state.automationCalls.push({ fn: 'handleJobScheduled', tenantId, jobId });
    },
  );

  // --- PDF (bypass Puppeteer) ---
  mocks.pdfGenerateBuffer.mockResolvedValue(Buffer.from('fake-pdf'));
  mocks.pdfUploadQuotePdf.mockResolvedValue({ file_id: FILE_ID });

  // --- R2 ---
  mocks.r2UploadBuffer.mockResolvedValue(undefined);
}

// ============================================
// Auth helper (per-test, uses test-file-local mock refs)
// ============================================

export interface AuthMocks {
  findUserByEmail: Mock;
  findUserRoles: Mock;
  saveRefreshToken: Mock;
  updateLastLogin: Mock;
}

let cachedHash: string | null = null;
async function getTestHash(): Promise<string> {
  if (!cachedHash) cachedHash = await bcrypt.hash(TEST_PASSWORD, 4);
  return cachedHash;
}

export async function loginAs(
  app: Express,
  role: string,
  mocks: AuthMocks,
  opts: { tenantId?: string; userId?: string } = {},
): Promise<string> {
  const tenantId = opts.tenantId ?? TENANT_A;
  const userId =
    opts.userId ??
    (role === 'coordinator'
      ? USER_COORDINATOR
      : role === 'crew_member' || role === 'crew_leader'
        ? USER_CREW
        : USER_OWNER);

  mocks.findUserByEmail.mockResolvedValue({
    id: userId,
    tenant_id: tenantId,
    email: `${role}@test.com`,
    password_hash: await getTestHash(),
    first_name: 'Test',
    last_name: role,
    is_active: true,
  });
  mocks.findUserRoles.mockResolvedValue([
    { role_name: role, division_id: null, division_name: null },
  ]);
  mocks.saveRefreshToken.mockResolvedValue(undefined);
  mocks.updateLastLogin.mockResolvedValue(undefined);

  const res = await request(app)
    .post('/auth/login')
    .send({ email: `${role}@test.com`, password: TEST_PASSWORD });

  if (!res.body?.data?.accessToken) {
    throw new Error(
      `loginAs(${role}) failed: status=${res.status} body=${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data.accessToken as string;
}
