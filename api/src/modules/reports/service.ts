import * as repo from './repository.js';
import type {
  ReportQuery,
  RevenueByCustomerQuery,
  ContractRenewalQuery,
  SnowProfitQuery,
  MaterialUsageQuery,
  SeasonCompletionQuery,
  OccurrenceStatusQuery,
  SkippedVisitsQuery,
  TierPerformanceQuery,
} from './schema.js';

export async function getRevenueSummary(tenantId: string, query: ReportQuery) {
  return repo.getRevenueSummary(tenantId, query.date_from, query.date_to, query.division);
}

export async function getRevenueByDivision(tenantId: string, query: ReportQuery) {
  return repo.getRevenueByDivision(tenantId, query.date_from, query.date_to);
}

export async function getRevenueByCustomer(tenantId: string, query: RevenueByCustomerQuery) {
  return repo.getRevenueByCustomer(tenantId, query.date_from, query.date_to, query.limit);
}

export async function getInvoiceAging(tenantId: string, query: ReportQuery) {
  return repo.getInvoiceAging(tenantId, query.division);
}

export async function getContractRenewals(tenantId: string, query: ContractRenewalQuery) {
  return repo.getContractRenewals(tenantId, query.days_ahead);
}

export async function getCrewProductivity(tenantId: string, query: ReportQuery) {
  return repo.getCrewProductivity(tenantId, query.date_from, query.date_to, query.division);
}

export async function getTimeTrackingSummary(tenantId: string, query: ReportQuery) {
  return repo.getTimeTrackingSummary(tenantId, query.date_from, query.date_to, query.division);
}

export async function getSnowProfitability(tenantId: string, query: SnowProfitQuery) {
  return repo.getSnowProfitability(tenantId, query.season_id);
}

export async function getHardscapePipeline(tenantId: string) {
  return repo.getHardscapePipeline(tenantId);
}

export async function getProspectConversion(tenantId: string) {
  return repo.getProspectConversion(tenantId);
}

export async function getEquipmentSummary(tenantId: string) {
  return repo.getEquipmentSummary(tenantId);
}

export async function getMaterialUsage(tenantId: string, query: MaterialUsageQuery) {
  return repo.getMaterialUsage(tenantId, query.date_from, query.date_to);
}

// ============================================
// Wave 7 Brief 04 — Service Package Analytics (I-5)
// ============================================

function sumTotals(rows: repo.SeasonCompletionRow[]) {
  const totals = { total: 0, done: 0, assigned: 0, pending: 0, skipped: 0 };
  for (const r of rows) {
    totals.total += r.total;
    totals.done += r.done;
    totals.assigned += r.assigned;
    totals.pending += r.pending;
    totals.skipped += r.skipped;
  }
  const completion_rate = totals.total > 0
    ? Math.round(((totals.done + totals.assigned) / totals.total) * 1000) / 10
    : 0;
  return { ...totals, completion_rate };
}

export async function getSeasonCompletion(tenantId: string, query: SeasonCompletionQuery) {
  const rows = await repo.getSeasonCompletion(
    tenantId, query.season_year, query.division, query.tier,
  );
  const withFlag = rows.map((r) => ({
    ...r,
    is_complete: r.pending === 0 && r.skipped === 0 && r.total > 0,
  }));
  return {
    season_year: query.season_year,
    totals: sumTotals(rows),
    rows: withFlag,
  };
}

export async function getOccurrenceStatus(tenantId: string, query: OccurrenceStatusQuery) {
  const rows = await repo.getOccurrenceStatus(
    tenantId,
    query.service_code,
    query.season_year,
    {
      status: query.status,
      category: query.category,
      occurrence_number: query.occurrence_number,
    },
  );
  const totals = { pending: 0, assigned: 0, completed: 0, skipped: 0 };
  for (const r of rows) {
    if (r.status in totals) {
      (totals as Record<string, number>)[r.status]++;
    }
  }
  return {
    service_code: query.service_code,
    service_name: rows[0]?.service_name ?? null,
    preferred_month: rows[0]?.preferred_month ?? null,
    totals,
    rows,
  };
}

function billingImpact(
  tier: string,
  bronzeBillingType: string | null,
  isIncludedInInvoice: boolean,
  recoveryDate: string | null,
): string {
  if (tier === 'bronze' && bronzeBillingType === 'per_cut') {
    return recoveryDate ? 'Recovered' : 'Excluded';
  }
  // Gold / Silver / Bronze flat_monthly: skipped visits do not affect the
  // monthly invoice (included is TRUE for Bronze but billing is flat).
  void isIncludedInInvoice;
  return 'None';
}

export async function getSkippedVisits(tenantId: string, query: SkippedVisitsQuery) {
  const rows = await repo.getSkippedVisits(tenantId, query.season_year, {
    tier: query.tier,
    from_date: query.from_date,
    to_date: query.to_date,
  });

  const enriched = rows.map((r) => ({
    id: r.id,
    skipped_date: r.skipped_date,
    skipped_reason: r.skipped_reason,
    recovery_date: r.recovery_date,
    occurrence_label: `${r.occurrence_number}`,
    service_name: r.service_name,
    customer_name: r.customer_name,
    customer_number: r.customer_number,
    property: r.street_address,
    service_tier: r.service_tier,
    billing_impact: billingImpact(
      r.service_tier,
      r.bronze_billing_type,
      r.is_included_in_invoice,
      r.recovery_date,
    ),
  }));

  const by_reason: Record<string, number> = {};
  for (const r of rows) {
    const key = r.skipped_reason ?? 'unknown';
    by_reason[key] = (by_reason[key] ?? 0) + 1;
  }

  return {
    totals: {
      total: rows.length,
      recovered: rows.filter((r) => r.recovery_date !== null).length,
      unrecovered: rows.filter((r) => r.recovery_date === null).length,
      by_reason,
    },
    rows: enriched,
  };
}

export async function getTierPerformance(tenantId: string, query: TierPerformanceQuery) {
  const rows = await repo.getTierPerformance(tenantId, query.season_year);
  const totals = rows.reduce(
    (acc, r) => ({
      active_contracts: acc.active_contracts + r.active_contracts,
      season_revenue: acc.season_revenue + r.season_revenue,
    }),
    { active_contracts: 0, season_revenue: 0 },
  );
  return {
    season_year: query.season_year,
    rows,
    totals,
  };
}
