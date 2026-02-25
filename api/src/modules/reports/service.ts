import * as repo from './repository.js';
import type {
  ReportQuery,
  RevenueByCustomerQuery,
  ContractRenewalQuery,
  SnowProfitQuery,
  MaterialUsageQuery,
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
