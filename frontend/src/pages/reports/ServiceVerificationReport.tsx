/**
 * R-GPS-03 — Service Verification report.
 *
 * Columns for every scheduled occurrence: was the visit GPS-verified?
 * Filters: season_year, service_code, tier, verification, crew, date range.
 * Multi-value verification filter via toggle chips.
 * CSV export.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useApiGet } from '@/hooks/useApi';
import type { ServiceVerificationResponse, ServiceVerificationRow } from '@/api/reports-v2';
import { cn } from '@/lib/utils';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { KpiStrip } from './_components/KpiStrip';
import { ReportTable } from './_components/ReportTable';

const ALL = '__all__';
type VerificationStatus = ServiceVerificationRow['verification_status'];

function statusIcon(status: VerificationStatus) {
  if (status === 'verified')
    return <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Verified" />;
  if (status === 'unverified')
    return <AlertTriangle className="h-4 w-4 text-yellow-600" aria-label="Unverified" />;
  return <HelpCircle className="h-4 w-4 text-muted-foreground" aria-label="No GPS" />;
}

function statusLabel(status: VerificationStatus): string {
  if (status === 'verified') return 'Verified';
  if (status === 'unverified') return 'Unverified';
  return 'No GPS';
}

const STATUS_CHIPS: VerificationStatus[] = ['verified', 'unverified', 'no_gps'];

export default function ServiceVerificationReport() {
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [serviceCode, setServiceCode] = useState<string>('');
  const [tier, setTier] = useState<string>(ALL);
  // Multi-value filter. Server endpoint only accepts a single value, so when
  // multiple chips are active we fetch "all" and filter client-side.
  const [verifications, setVerifications] = useState<Set<VerificationStatus>>(
    new Set(STATUS_CHIPS),
  );

  const serverVerification = useMemo<VerificationStatus | undefined>(() => {
    if (verifications.size === 1) return [...verifications][0];
    return undefined;
  }, [verifications]);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { season_year: seasonYear };
    if (serviceCode.trim()) p.service_code = serviceCode.trim();
    if (tier !== ALL) p.tier = tier;
    if (serverVerification) p.verification = serverVerification;
    return p;
  }, [seasonYear, serviceCode, tier, serverVerification]);

  const { data, isLoading, error } = useApiGet<ServiceVerificationResponse>(
    ['report-service-verification', seasonYear, serviceCode, tier, serverVerification],
    '/v1/reports/service-verification',
    params,
    { staleTime: 60_000 },
  );

  const visibleRows = useMemo(() => {
    if (!data) return [];
    // If all chips active or single-chip already server-filtered, no client filter needed.
    if (verifications.size === STATUS_CHIPS.length || serverVerification) return data.rows;
    return data.rows.filter((r) => verifications.has(r.verification_status));
  }, [data, verifications, serverVerification]);

  const toggleChip = (status: VerificationStatus) => {
    setVerifications((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size === 1) return prev; // keep at least one active
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Service Verification"
        description="Did each scheduled occurrence happen per GPS?"
      />

      <ReportFilters
        actions={
          <CsvExportButton
            endpoint="/v1/reports/service-verification"
            params={params}
            filename={`service-verification-${seasonYear}.csv`}
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
          placeholder="Service code"
          value={serviceCode}
          onChange={(e) => setServiceCode(e.target.value.toUpperCase())}
          className="w-40"
          aria-label="Service code"
        />
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-40" aria-label="Tier">
            <SelectValue placeholder="All tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tiers</SelectItem>
            <SelectItem value="gold">Gold</SelectItem>
            <SelectItem value="silver">Silver</SelectItem>
            <SelectItem value="bronze">Bronze</SelectItem>
          </SelectContent>
        </Select>
        <div
          className="flex gap-1"
          role="group"
          aria-label="Verification filter"
        >
          {STATUS_CHIPS.map((s) => {
            const active = verifications.has(s);
            return (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => toggleChip(s)}
                aria-pressed={active}
                aria-label={`Toggle ${statusLabel(s)}`}
                className={cn(
                  active ? '' : 'text-muted-foreground',
                )}
              >
                {statusLabel(s)}
              </Button>
            );
          })}
        </div>
      </ReportFilters>

      <KpiStrip
        columns={5}
        loading={isLoading}
        items={
          data
            ? [
              { label: 'Total', value: data.totals.total },
              { label: 'Verified', value: data.totals.verified, accent: 'text-green-600' },
              { label: 'Unverified', value: data.totals.unverified, accent: 'text-yellow-600' },
              { label: 'No GPS', value: data.totals.no_gps, accent: 'text-muted-foreground' },
              {
                label: 'Verification Rate',
                value: `${data.totals.verification_rate.toFixed(1)}%`,
              },
            ]
            : []
        }
      />

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && visibleRows.length === 0}
        emptyMessage="No scheduled occurrences match the current filters."
        errorPrefix="Failed to load verification"
      >
        {visibleRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Occurrence</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-24">GPS</TableHead>
                <TableHead className="text-right">Time on Site</TableHead>
                <TableHead>Crew</TableHead>
                <TableHead>Job</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((r) => (
                <TableRow key={r.occurrence_id}>
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell>{r.street_address ?? '—'}</TableCell>
                  <TableCell>{r.service_name}</TableCell>
                  <TableCell>{r.occurrence_label}</TableCell>
                  <TableCell>{r.assigned_date ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {statusIcon(r.verification_status)}
                      <span className="text-xs">{statusLabel(r.verification_status)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.time_on_site_minutes === null ? '—' : `${r.time_on_site_minutes} min`}
                  </TableCell>
                  <TableCell>{r.crew_member ?? '—'}</TableCell>
                  <TableCell>{r.job_number ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </ReportTable>
    </div>
  );
}
