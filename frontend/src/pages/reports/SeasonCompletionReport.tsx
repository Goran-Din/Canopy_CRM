/**
 * R-PKG-01 — Season Completion report.
 *
 * Filters: season year, division, tier (Gold/Silver only — Bronze excluded
 *   because it has no occurrences per I-5).
 * KPI strip: Total / Done / Assigned / Pending / Skipped / Overall %.
 * Table: one row per service with per-status counts + completion rate + ✅ flag.
 * CSV export via ?format=csv.
 * Role-guarded at API (owner / div_mgr / coordinator).
 */
import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useApiGet } from '@/hooks/useApi';
import type { SeasonCompletionResponse } from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { KpiStrip } from './_components/KpiStrip';
import { ReportTable } from './_components/ReportTable';

const ALL = '__all__';

export default function SeasonCompletionReport() {
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [division, setDivision] = useState<string>(ALL);
  const [tier, setTier] = useState<string>(ALL);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { season_year: seasonYear };
    if (division !== ALL) p.division = division;
    if (tier !== ALL) p.tier = tier;
    return p;
  }, [seasonYear, division, tier]);

  const { data, isLoading, error } = useApiGet<SeasonCompletionResponse>(
    ['report-season-completion', seasonYear, division, tier],
    '/v1/reports/season-completion',
    params,
    { staleTime: 60_000 },
  );

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Season Completion"
        description="Service completion progress across active contracts"
      />

      <ReportFilters
        actions={
          <CsvExportButton
            endpoint="/v1/reports/season-completion"
            params={params}
            filename={`season-completion-${seasonYear}.csv`}
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
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="w-56" aria-label="Division">
            <SelectValue placeholder="All divisions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All divisions</SelectItem>
            <SelectItem value="landscaping_maintenance">Landscaping Maintenance</SelectItem>
            <SelectItem value="landscaping_projects">Landscaping Projects</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-40" aria-label="Service tier">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tiers</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
          </SelectContent>
        </Select>
      </ReportFilters>

      <KpiStrip
        columns={6}
        loading={isLoading}
        items={
          data
            ? [
              { label: 'Total', value: data.totals.total },
              { label: 'Done', value: data.totals.done, accent: 'text-green-600' },
              { label: 'Assigned', value: data.totals.assigned, accent: 'text-blue-600' },
              { label: 'Pending', value: data.totals.pending, accent: 'text-yellow-600' },
              { label: 'Skipped', value: data.totals.skipped, accent: 'text-red-600' },
              { label: 'Overall %', value: `${data.totals.completion_rate.toFixed(1)}%` },
            ]
            : []
        }
      />

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && data.rows.length === 0}
        emptyMessage={`No occurrences scheduled for season ${seasonYear}.`}
        errorPrefix="Failed to load season completion"
      >
        {data && data.rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Per Season</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Done</TableHead>
                <TableHead className="text-right">Assigned</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Completion</TableHead>
                <TableHead className="w-10"><span className="sr-only">Complete flag</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.service_code}>
                  <TableCell className="font-medium">{r.service_name}</TableCell>
                  <TableCell className="text-right">{r.per_season}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right text-green-600">{r.done}</TableCell>
                  <TableCell className="text-right">{r.assigned}</TableCell>
                  <TableCell className="text-right text-yellow-600">{r.pending}</TableCell>
                  <TableCell className="text-right text-red-600">{r.skipped}</TableCell>
                  <TableCell className="text-right font-medium">
                    {r.completion_rate.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    {r.is_complete ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Complete" />
                    ) : null}
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
