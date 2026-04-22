import type { Request, Response, NextFunction } from 'express';
import * as reportService from './service.js';

export async function revenueSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getRevenueSummary(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function revenueByDivision(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getRevenueByDivision(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function revenueByCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getRevenueByCustomer(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function invoiceAging(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getInvoiceAging(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function contractRenewals(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getContractRenewals(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function crewProductivity(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getCrewProductivity(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function timeTrackingSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getTimeTrackingSummary(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function snowProfitability(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getSnowProfitability(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function hardscapePipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getHardscapePipeline(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function prospectConversion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getProspectConversion(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function equipmentSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getEquipmentSummary(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function materialUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getMaterialUsage(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

// ============================================
// Wave 7 Brief 04 — Service Package Analytics
// ============================================

function escapeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  if (rows.length === 0) {
    return columns.map((c) => String(c)).join(',') + '\n';
  }
  const header = columns.map((c) => String(c)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsvValue(row[c])).join(','))
    .join('\n');
  return header + '\n' + body + '\n';
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function seasonCompletion(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getSeasonCompletion(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'service_code', 'service_name', 'per_season',
        'total', 'done', 'assigned', 'pending', 'skipped',
        'completion_rate', 'is_complete',
      ]);
      return sendCsv(res, `season-completion-${data.season_year}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function occurrenceStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getOccurrenceStatus(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'occurrence_id', 'service_code', 'service_name', 'occurrence_number', 'status',
        'assigned_date', 'customer_name', 'customer_number', 'street_address',
        'city', 'property_category', 'job_number', 'service_tier',
      ]);
      return sendCsv(res, `occurrence-status-${data.service_code}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function skippedVisits(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getSkippedVisits(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'id', 'skipped_date', 'skipped_reason', 'recovery_date',
        'occurrence_label', 'service_name', 'customer_name', 'customer_number',
        'property', 'service_tier', 'billing_impact',
      ]);
      return sendCsv(res, `skipped-visits-${q.season_year ?? 'current'}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function tierPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getTierPerformance(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'tier', 'active_contracts', 'season_revenue', 'avg_contract_value',
        'total_occurrences', 'skipped_visits', 'service_completion_rate', 'clients_retained_pct',
      ]);
      return sendCsv(res, `tier-performance-${data.season_year}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

// ============================================
// Wave 7 Brief 05 — GPS Analytics
// ============================================

export async function propertyVisitHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getPropertyVisitHistory(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'arrival_at', 'departure_at', 'time_on_site_minutes', 'crew_member',
        'job_number', 'verification_status', 'distance_from_centre_at_departure',
      ]);
      return sendCsv(res, `property-visits-${data.property_id}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

/**
 * Payroll cross-check.
 *
 * INFORMATIONAL ONLY. Payroll is always calculated from clocked time entries.
 * The Resolve action records a supervisor note and does not adjust pay.
 */
export async function payrollCrossCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getPayrollCrossCheck(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'work_date', 'crew_member', 'layer1_minutes', 'layer2_minutes',
        'diff_minutes', 'diff_pct', 'properties_visited', 'status',
      ]);
      return sendCsv(res, `payroll-cross-check-${q.from_date}-to-${q.to_date}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function resolvePayrollCrossCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.resolvePayrollCrossCheck(
      req.tenantId!,
      req.params.gps_event_id,
      req.body.note,
    );
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function serviceVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getServiceVerification(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'occurrence_id', 'customer_name', 'street_address', 'service_code',
        'service_name', 'occurrence_label', 'assigned_date', 'job_number',
        'verification_status', 'time_on_site_minutes', 'crew_member', 'service_tier',
      ]);
      return sendCsv(res, `service-verification-${q.season_year ?? 'current'}.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function routePerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const data = await reportService.getRoutePerformance(req.tenantId!, q as never);
    if (q.format === 'csv') {
      const csv = rowsToCsv(data.rows, [
        'property_id', 'street_address', 'property_category', 'estimated_duration_minutes',
        'avg_actual', 'variance_minutes', 'variance_pct', 'visit_count', 'trend',
      ]);
      return sendCsv(res, `route-performance.csv`, csv);
    }
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}
