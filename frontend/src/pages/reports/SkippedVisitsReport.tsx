/**
 * R-PKG-03 — Skipped Visits report.
 *
 * Filters: season year, tier, date range.
 * KPI strip + "by_reason" breakdown list.
 * Table: skipped occurrences with billing impact.
 * CSV export.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useApiGet } from '@/hooks/useApi';
import type { SkippedVisitsResponse } from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { KpiStrip } from './_components/KpiStrip';
import { ReportTable } from './_components/ReportTable';

const ALL = '__all__';

function impactTone(impact: string): string {
  if (impact === 'Recovered') return 'bg-green-100 text-green-800 border-green-200';
  if (impact === 'Excluded') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

export default function SkippedVisitsReport() {
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [tier, setTier] = useState<string>(ALL);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const params = useMemo(() => {
    const p: Record<string, unknown> = { season_year: seasonYear };
    if (tier !== ALL) p.tier = tier;
    if (fromDate) p.from_date = fromDate;
    if (toDate) p.to_date = toDate;
    return p;
  }, [seasonYear, tier, fromDate, toDate]);

  const { data, isLoading, error } = useApiGet<SkippedVisitsResponse>(
    ['report-skipped-visits', seasonYear, tier, fromDate, toDate],
    '/v1/reports/skipped-visits',
    params,
    { staleTime: 60_000 },
  );

  const reasonRows = data
    ? Object.entries(data.totals.by_reason).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Skipped Visits"
        description="Occurrences skipped this season, with billing impact"
      />

      <ReportFilters
        actions={
          <CsvExportButton
            endpoint="/v1/reports/skipped-visits"
            params={params}
            filename={`skipped-visits-${seasonYear}.csv`}
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
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-40" aria-label="Service tier">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tiers</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-44"
          aria-label="From date"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-44"
          aria-label="To date"
        />
      </ReportFilters>

      <KpiStrip
        columns={3}
        loading={isLoading}
        items={
          data
            ? [
              { label: 'Total Skipped', value: data.totals.total },
              { label: 'Recovered', value: data.totals.recovered, accent: 'text-green-600' },
              { label: 'Unrecovered', value: data.totals.unrecovered, accent: 'text-red-600' },
            ]
            : []
        }
      />

      {data && reasonRows.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-3">Skips by reason</p>
            <div className="space-y-2" aria-label="Skipped by reason">
              {reasonRows.map(([reason, count]) => {
                const pct = data.totals.total > 0 ? (count / data.totals.total) * 100 : 0;
                return (
                  <div key={reason} className="flex items-center gap-3">
                    <span className="w-40 text-sm capitalize">{reason.replace(/_/g, ' ')}</span>
                    <div className="flex-1 bg-muted rounded h-3 overflow-hidden">
                      <div
                        className="bg-red-500 h-3"
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={count}
                        aria-valuemax={data.totals.total}
                        aria-label={`${reason} count`}
                      />
                    </div>
                    <span className="w-8 text-right text-sm tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && data.rows.length === 0}
        emptyMessage="No skipped occurrences in this range."
        errorPrefix="Failed to load"
      >
        {data && data.rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Skipped</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Recovery Date</TableHead>
                <TableHead>Billing Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.skipped_date ?? '—'}</TableCell>
                  <TableCell className="font-medium">
                    {r.customer_name}
                    {r.customer_number ? (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({r.customer_number})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{r.property ?? '—'}</TableCell>
                  <TableCell>{r.service_name}</TableCell>
                  <TableCell className="capitalize">{r.service_tier}</TableCell>
                  <TableCell className="capitalize">{r.skipped_reason ?? '—'}</TableCell>
                  <TableCell>{r.recovery_date ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={impactTone(r.billing_impact)}>
                      {r.billing_impact}
                    </Badge>
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
