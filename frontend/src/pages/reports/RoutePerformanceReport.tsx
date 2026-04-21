/**
 * R-GPS-04 — Route Performance report.
 *
 * Estimated vs actual dwell time per property. Default sort: variance_pct DESC
 * (biggest over-runs first, per spec §5). Trend column uses emoji arrows.
 */
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useApiGet } from '@/hooks/useApi';
import type { RoutePerformanceResponse, RoutePerformanceRow } from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { ReportTable } from './_components/ReportTable';

function trendEmoji(trend: RoutePerformanceRow['trend']): string {
  if (trend === 'increasing') return '📈';
  if (trend === 'decreasing') return '📉';
  return '➡️';
}

function formatMin(n: number | null): string {
  if (n === null) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}

export default function RoutePerformanceReport() {
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [minVisitCount, setMinVisitCount] = useState<number>(3);

  const params = useMemo(
    () => ({ season_year: seasonYear, min_visit_count: minVisitCount }),
    [seasonYear, minVisitCount],
  );

  const { data, isLoading, error } = useApiGet<RoutePerformanceResponse>(
    ['report-route-performance', seasonYear, minVisitCount],
    '/v1/reports/route-performance',
    params,
    { staleTime: 60_000 },
  );

  // Default sort: variance_pct DESC (nulls last). Server already does this,
  // but we sort client-side too so the UI is defensible if order drifts.
  const sortedRows = useMemo(() => {
    if (!data) return [];
    return [...data.rows].sort((a, b) => {
      const av = a.variance_pct;
      const bv = b.variance_pct;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Route Performance"
        description="Estimated vs actual dwell time per property"
      />

      <ReportFilters
        actions={
          <CsvExportButton
            endpoint="/v1/reports/route-performance"
            params={params}
            filename={`route-performance-${seasonYear}.csv`}
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
        <Input
          type="number"
          min={1}
          value={minVisitCount}
          onChange={(e) => setMinVisitCount(Number(e.target.value))}
          className="w-28"
          aria-label="Min visit count"
        />
      </ReportFilters>

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && sortedRows.length === 0}
        emptyMessage="No properties meet the minimum-visit threshold."
        errorPrefix="Failed to load route performance"
        skeletonClassName="h-96"
      >
        {sortedRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Est. (min)</TableHead>
                <TableHead className="text-right">Actual (min)</TableHead>
                <TableHead className="text-right">Variance (min)</TableHead>
                <TableHead className="text-right">Variance %</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="w-20">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r) => (
                <TableRow key={r.property_id}>
                  <TableCell className="font-medium">{r.street_address ?? r.property_id}</TableCell>
                  <TableCell className="capitalize">{r.property_category ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {r.estimated_duration_minutes ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">{r.avg_actual.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatMin(r.variance_minutes)}</TableCell>
                  <TableCell className="text-right">
                    {r.variance_pct === null
                      ? '—'
                      : `${r.variance_pct > 0 ? '+' : ''}${r.variance_pct.toFixed(1)}%`}
                  </TableCell>
                  <TableCell className="text-right">{r.visit_count}</TableCell>
                  <TableCell>
                    <span aria-label={`Trend: ${r.trend}`}>{trendEmoji(r.trend)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </ReportTable>
    </div>
  );
}
