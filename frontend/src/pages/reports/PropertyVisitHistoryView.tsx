/**
 * R-GPS-01 body — reusable view.
 *
 * Lives outside `_components/` because it is imported by the Property Card
 * (frontend/src/pages/properties/…) as well as the standalone report page.
 * The underscore convention signals "private to this folder" — dropping it
 * here matches how the file is actually used.
 */
import { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useApiGet } from '@/hooks/useApi';
import type { PropertyVisitHistoryResponse, PropertyVisitRow } from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportFilters } from './_components/ReportFilters';
import { KpiStrip } from './_components/KpiStrip';
import { ReportTable } from './_components/ReportTable';

interface PropertyVisitHistoryViewProps {
  propertyId: string;
  /** When true, CSV export button is hidden (embedded contexts supply their own chrome). */
  hideExport?: boolean;
}

function statusIcon(status: PropertyVisitRow['verification_status']) {
  if (status === 'verified')
    return <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Verified" />;
  if (status === 'flagged')
    return <AlertTriangle className="h-4 w-4 text-red-600" aria-label="Flagged" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label="Unverified" />;
}

function getDefaultSeasonRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const from = new Date(year, 3, 1); // April 1
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export function PropertyVisitHistoryView({ propertyId, hideExport }: PropertyVisitHistoryViewProps) {
  const defaults = useMemo(getDefaultSeasonRange, []);
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Reset dates if propertyId changes (embedded view switching properties)
  useEffect(() => {
    setFromDate(defaults.from);
    setToDate(defaults.to);
    setVerifiedOnly(false);
  }, [propertyId, defaults.from, defaults.to]);

  const params = useMemo(() => {
    const p: Record<string, unknown> = {
      property_id: propertyId,
      from_date: fromDate,
      to_date: toDate,
    };
    if (verifiedOnly) p.verified_only = true;
    return p;
  }, [propertyId, fromDate, toDate, verifiedOnly]);

  const { data, isLoading, error } = useApiGet<PropertyVisitHistoryResponse>(
    ['report-property-visits', propertyId, fromDate, toDate, String(verifiedOnly)],
    '/v1/reports/property-visit-history',
    params,
    { enabled: propertyId.length > 0, staleTime: 60_000 },
  );

  const summaryItems = data
    ? [
      { label: 'Total Visits', value: data.summary.total_visits },
      { label: 'Verified', value: data.summary.verified_visits, accent: 'text-green-600' },
      { label: 'Avg Time on Site', value: `${data.summary.avg_time_on_site_minutes} min` },
      {
        label: 'Estimate',
        value: data.summary.scheduled_estimate_minutes === null
          ? '—'
          : `${data.summary.scheduled_estimate_minutes} min`,
      },
      {
        label: 'Variance',
        value: data.summary.variance_minutes === null
          ? '—'
          : `${data.summary.variance_minutes > 0 ? '+' : ''}${data.summary.variance_minutes} min`,
        accent: data.summary.variance_minutes !== null && data.summary.variance_minutes > 0
          ? 'text-red-600'
          : 'text-green-600',
      },
    ]
    : [];

  return (
    <div className="space-y-4">
      <ReportFilters
        actions={
          hideExport ? null : (
            <CsvExportButton
              endpoint="/v1/reports/property-visit-history"
              params={params}
              filename={`property-visits-${propertyId}.csv`}
              disabled={isLoading}
            />
          )
        }
      >
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
        <Label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={verifiedOnly}
            onCheckedChange={(checked) => setVerifiedOnly(checked === true)}
            aria-label="Verified only"
          />
          <span className="text-sm">Verified only</span>
        </Label>
      </ReportFilters>

      <KpiStrip columns={5} loading={isLoading} items={summaryItems} />

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && data.rows.length === 0}
        emptyMessage="No GPS visits recorded for this property in this range."
        errorPrefix="Failed to load visits"
      >
        {data && data.rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arrival</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead className="text-right">Time on Site</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="text-right">Dist. (m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r, i) => (
                <TableRow key={`${r.arrival_at}-${i}`}>
                  <TableCell>{new Date(r.arrival_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {r.departure_at ? new Date(r.departure_at).toLocaleString() : 'still on site'}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.time_on_site_minutes === null ? '—' : `${r.time_on_site_minutes} min`}
                  </TableCell>
                  <TableCell>{r.crew_member}</TableCell>
                  <TableCell>{r.job_number ?? '—'}</TableCell>
                  <TableCell>{statusIcon(r.verification_status)}</TableCell>
                  <TableCell className="text-right">
                    {r.distance_from_centre_at_departure === null
                      ? '—'
                      : r.distance_from_centre_at_departure.toFixed(1)}
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
