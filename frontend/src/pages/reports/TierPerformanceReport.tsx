/**
 * R-PKG-04 — Tier Performance comparison (OWNER ONLY).
 *
 * Transposed table: columns are tiers (Gold/Silver/Bronze/Total), rows are
 * metrics. Non-owners are redirected to /reports with a toast (same pattern
 * as PayrollCrossCheckReport).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useApiGet } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/authStore';
import type {
  TierPerformanceResponse, TierPerformanceRow,
} from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { ReportTable } from './_components/ReportTable';

function currency(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n)}%`;
}

interface MetricDef {
  label: string;
  get: (row: TierPerformanceRow) => string;
  totalKey?: keyof TierPerformanceResponse['totals'];
  format?: (n: number) => string;
}

const METRICS: MetricDef[] = [
  { label: 'Active Contracts', get: (r) => String(r.active_contracts), totalKey: 'active_contracts' },
  { label: 'Season Revenue', get: (r) => currency(r.season_revenue), totalKey: 'season_revenue', format: currency },
  { label: 'Avg Contract Value', get: (r) => currency(r.avg_contract_value) },
  { label: 'Total Occurrences', get: (r) => String(r.total_occurrences) },
  { label: 'Skipped Visits', get: (r) => String(r.skipped_visits) },
  { label: 'Service Completion Rate', get: (r) => pct(r.service_completion_rate) },
  { label: 'Clients Retained %', get: (r) => `${r.clients_retained_pct}%` },
];

export default function TierPerformanceReport() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.roles.some((r) => r.role === 'owner') ?? false;

  useEffect(() => {
    if (user && !isOwner) {
      toast.error('This report is owner-only.');
      navigate('/reports', { replace: true });
    }
  }, [user, isOwner, navigate]);

  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());

  const params = useMemo(() => ({ season_year: seasonYear }), [seasonYear]);

  const { data, isLoading, error } = useApiGet<TierPerformanceResponse>(
    ['report-tier-performance', seasonYear],
    '/v1/reports/tier-performance',
    params,
    { enabled: isOwner, staleTime: 60_000 },
  );

  if (!isOwner) return null;

  const tierOrder: Array<TierPerformanceRow['tier']> = ['gold', 'silver', 'bronze'];
  const byTier = new Map(data?.rows.map((r) => [r.tier, r]) ?? []);

  return (
    <div className="space-y-6">
      <ReportHeader title="Tier Performance" description="Gold vs Silver vs Bronze comparison" />

      <ReportFilters
        actions={
          <CsvExportButton
            endpoint="/v1/reports/tier-performance"
            params={params}
            filename={`tier-performance-${seasonYear}.csv`}
            disabled={isLoading}
          />
        }
      >
        <Input
          type="number"
          min={2020}
          max={2100}
          value={seasonYear}
          onChange={(e) => setSeasonYear(Number(e.target.value))}
          className="w-28"
          aria-label="Season year"
        />
      </ReportFilters>

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && data.rows.length === 0}
        emptyMessage="No tier data for this season."
        errorPrefix="Failed to load"
        skeletonClassName="h-96"
      >
        {data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Gold</TableHead>
                <TableHead className="text-right">Silver</TableHead>
                <TableHead className="text-right">Bronze</TableHead>
                <TableHead className="text-right font-semibold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRICS.map((metric) => {
                const total = metric.totalKey
                  ? metric.format
                    ? metric.format(data.totals[metric.totalKey])
                    : String(data.totals[metric.totalKey])
                  : '—';
                return (
                  <TableRow key={metric.label}>
                    <TableCell className="font-medium">{metric.label}</TableCell>
                    {tierOrder.map((tier) => {
                      const row = byTier.get(tier);
                      return (
                        <TableCell key={tier} className="text-right">
                          {row ? metric.get(row) : '—'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold">{total}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </ReportTable>
    </div>
  );
}
