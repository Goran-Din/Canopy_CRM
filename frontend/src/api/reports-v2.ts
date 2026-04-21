/**
 * Wave 7 Brief 06 — API client for V2 reports (I-3 v2 + I-5 endpoints).
 *
 * Thin wrapper over apiClient + typed result shapes so pages don't duplicate.
 */
import { apiClient } from './client';

// ============================================
// R-PKG-01: season-completion
// ============================================
export interface SeasonCompletionRow {
  service_code: string;
  service_name: string;
  per_season: number;
  total: number;
  done: number;
  assigned: number;
  pending: number;
  skipped: number;
  completion_rate: number;
  is_complete: boolean;
}

export interface SeasonCompletionResponse {
  season_year: number;
  totals: {
    total: number;
    done: number;
    assigned: number;
    pending: number;
    skipped: number;
    completion_rate: number;
  };
  rows: SeasonCompletionRow[];
}

export interface SeasonCompletionFilters {
  season_year?: number;
  division?: 'landscaping_maintenance' | 'landscaping_projects';
  tier?: 'gold' | 'silver';
}

export async function fetchSeasonCompletion(
  params: SeasonCompletionFilters,
): Promise<SeasonCompletionResponse> {
  const { data } = await apiClient.get('/v1/reports/season-completion', { params });
  return data.data;
}

// ============================================
// R-GPS-02: payroll-cross-check (owner-only)
// ============================================
export interface PayrollCrossCheckRow {
  gps_event_id: string | null;
  work_date: string;
  user_id: string;
  crew_member: string;
  layer1_minutes: number;
  layer2_minutes: number;
  diff_minutes: number;
  diff_pct: number | null;
  properties_visited: number;
  status: 'flagged' | 'reviewed' | 'consistent';
}

export interface PayrollCrossCheckResponse {
  totals: {
    days_reviewed: number;
    flagged_count: number;
    consistent_count: number;
  };
  rows: PayrollCrossCheckRow[];
}

export interface PayrollCrossCheckFilters {
  from_date: string;
  to_date: string;
  user_id?: string;
  status?: 'flagged' | 'reviewed' | 'consistent';
}

export async function fetchPayrollCrossCheck(
  params: PayrollCrossCheckFilters,
): Promise<PayrollCrossCheckResponse> {
  const { data } = await apiClient.get('/v1/reports/payroll-cross-check', { params });
  return data.data;
}

export async function resolvePayrollCrossCheck(
  gpsEventId: string,
  note: string,
): Promise<{ status: string; gps_event_id: string }> {
  const { data } = await apiClient.post(
    `/v1/reports/payroll-cross-check/${gpsEventId}/resolve`,
    { note },
  );
  return data.data;
}

// ============================================
// R-PKG-02: occurrence-status
// ============================================
export interface OccurrenceStatusRow {
  occurrence_id: string;
  service_code: string;
  service_name: string;
  occurrence_number: number;
  status: 'pending' | 'assigned' | 'completed' | 'skipped';
  assigned_date: string | null;
  preferred_month: string | null;
  customer_id: string;
  customer_name: string;
  customer_number: string | null;
  property_id: string;
  street_address: string | null;
  city: string | null;
  property_category: string | null;
  job_id: string | null;
  job_number: string | null;
  service_tier: string;
}

export interface OccurrenceStatusResponse {
  service_code: string;
  service_name: string | null;
  preferred_month: string | null;
  totals: { pending: number; assigned: number; completed: number; skipped: number };
  rows: OccurrenceStatusRow[];
}

export interface OccurrenceStatusFilters {
  service_code: string;
  occurrence_number?: number;
  season_year?: number;
  status?: 'pending' | 'assigned' | 'completed' | 'skipped';
  category?: string;
  crew_id?: string;
}

export async function fetchOccurrenceStatus(
  params: OccurrenceStatusFilters,
): Promise<OccurrenceStatusResponse> {
  const { data } = await apiClient.get('/v1/reports/occurrence-status', { params });
  return data.data;
}

export async function bulkAssignOccurrences(
  occurrenceIds: string[],
  assignedDate: string,
): Promise<{ jobs_created: number; occurrences_assigned: number }> {
  const { data } = await apiClient.post('/v1/service-occurrences/bulk-assign', {
    occurrence_ids: occurrenceIds,
    assigned_date: assignedDate,
  });
  return data.data;
}

// ============================================
// R-PKG-03: skipped-visits
// ============================================
export interface SkippedVisitRow {
  id: string;
  skipped_date: string | null;
  skipped_reason: string | null;
  recovery_date: string | null;
  occurrence_label: string;
  service_name: string;
  customer_name: string;
  customer_number: string | null;
  property: string | null;
  service_tier: string;
  billing_impact: string;
}

export interface SkippedVisitsResponse {
  totals: {
    total: number;
    recovered: number;
    unrecovered: number;
    by_reason: Record<string, number>;
  };
  rows: SkippedVisitRow[];
}

export interface SkippedVisitsFilters {
  season_year?: number;
  tier?: 'gold' | 'silver' | 'bronze';
  from_date?: string;
  to_date?: string;
}

export async function fetchSkippedVisits(
  params: SkippedVisitsFilters,
): Promise<SkippedVisitsResponse> {
  const { data } = await apiClient.get('/v1/reports/skipped-visits', { params });
  return data.data;
}

// ============================================
// R-PKG-04: tier-performance (owner-only)
// ============================================
export interface TierPerformanceRow {
  tier: 'gold' | 'silver' | 'bronze';
  active_contracts: number;
  season_revenue: number;
  avg_contract_value: number;
  total_occurrences: number;
  skipped_visits: number;
  service_completion_rate: number | null;
  clients_retained_pct: number;
}

export interface TierPerformanceResponse {
  season_year: number;
  rows: TierPerformanceRow[];
  totals: { active_contracts: number; season_revenue: number };
}

export interface TierPerformanceFilters {
  season_year?: number;
}

export async function fetchTierPerformance(
  params: TierPerformanceFilters,
): Promise<TierPerformanceResponse> {
  const { data } = await apiClient.get('/v1/reports/tier-performance', { params });
  return data.data;
}

// ============================================
// R-GPS-01: property-visit-history
// ============================================
export interface PropertyVisitRow {
  arrival_at: string;
  departure_at: string | null;
  time_on_site_minutes: number | null;
  crew_member: string;
  job_number: string | null;
  verification_status: 'verified' | 'flagged' | 'unverified';
  distance_from_centre_at_departure: number | null;
}

export interface PropertyVisitHistoryResponse {
  property_id: string;
  summary: {
    total_visits: number;
    verified_visits: number;
    avg_time_on_site_minutes: number;
    scheduled_estimate_minutes: number | null;
    variance_minutes: number | null;
  };
  rows: PropertyVisitRow[];
}

export interface PropertyVisitHistoryFilters {
  property_id: string;
  from_date?: string;
  to_date?: string;
  crew_member_id?: string;
  verified_only?: boolean;
}

export async function fetchPropertyVisitHistory(
  params: PropertyVisitHistoryFilters,
): Promise<PropertyVisitHistoryResponse> {
  const { data } = await apiClient.get('/v1/reports/property-visit-history', { params });
  return data.data;
}

// ============================================
// R-GPS-03: service-verification
// ============================================
export interface ServiceVerificationRow {
  occurrence_id: string;
  customer_name: string;
  street_address: string | null;
  service_code: string;
  service_name: string;
  occurrence_label: string;
  assigned_date: string | null;
  job_number: string | null;
  verification_status: 'verified' | 'unverified' | 'no_gps';
  time_on_site_minutes: number | null;
  crew_member: string | null;
  service_tier: string;
}

export interface ServiceVerificationResponse {
  totals: {
    total: number;
    verified: number;
    unverified: number;
    no_gps: number;
    verification_rate: number;
  };
  rows: ServiceVerificationRow[];
}

export interface ServiceVerificationFilters {
  season_year?: number;
  service_code?: string;
  tier?: 'gold' | 'silver' | 'bronze';
  verification?: 'verified' | 'unverified' | 'no_gps';
  crew_member_id?: string;
  from_date?: string;
  to_date?: string;
}

export async function fetchServiceVerification(
  params: ServiceVerificationFilters,
): Promise<ServiceVerificationResponse> {
  const { data } = await apiClient.get('/v1/reports/service-verification', { params });
  return data.data;
}

// ============================================
// R-GPS-04: route-performance
// ============================================
export interface RoutePerformanceRow {
  property_id: string;
  street_address: string | null;
  property_category: string | null;
  estimated_duration_minutes: number | null;
  avg_actual: number;
  variance_minutes: number | null;
  variance_pct: number | null;
  visit_count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface RoutePerformanceResponse {
  rows: RoutePerformanceRow[];
}

export interface RoutePerformanceFilters {
  season_year?: number;
  division?: string;
  crew_id?: string;
  from_date?: string;
  to_date?: string;
  min_visit_count?: number;
}

export async function fetchRoutePerformance(
  params: RoutePerformanceFilters,
): Promise<RoutePerformanceResponse> {
  const { data } = await apiClient.get('/v1/reports/route-performance', { params });
  return data.data;
}

// ============================================
// CSV download helper — shared by every report that exposes ?format=csv
// ============================================
export async function downloadReportCsv(
  endpoint: string,
  params: Record<string, unknown>,
  filename: string,
): Promise<void> {
  const res = await apiClient.get(endpoint, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data as Blob]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
