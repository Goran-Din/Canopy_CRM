/**
 * R-PKG-02 — Occurrence Status drill-down.
 *
 * Required filter: service_code. Optional: season_year, status, category.
 * Row selection → "Bulk Assign Date" action (D-28 endpoint).
 * CSV export.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useApiGet } from '@/hooks/useApi';
import {
  bulkAssignOccurrences, type OccurrenceStatusResponse, type OccurrenceStatusRow,
} from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { KpiStrip } from './_components/KpiStrip';
import { ReportTable } from './_components/ReportTable';

const ALL = '__all__';

function statusTone(status: OccurrenceStatusRow['status']): string {
  if (status === 'completed') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'assigned') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'skipped') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-yellow-100 text-yellow-800 border-yellow-200';
}

export default function OccurrenceStatusReport() {
  const [serviceCode, setServiceCode] = useState<string>('');
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());
  const [status, setStatus] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { season_year: seasonYear };
    if (serviceCode.trim()) p.service_code = serviceCode.trim();
    if (status !== ALL) p.status = status;
    if (category !== ALL) p.category = category;
    return p;
  }, [serviceCode, seasonYear, status, category]);

  const { data, isLoading, error, refetch } = useApiGet<OccurrenceStatusResponse>(
    ['report-occurrence-status', serviceCode, seasonYear, status, category],
    '/v1/reports/occurrence-status',
    params,
    { enabled: serviceCode.trim().length > 0, staleTime: 60_000 },
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitBulkAssign = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const result = await bulkAssignOccurrences([...selected], bulkDate);
      toast.success(`Created ${result.jobs_created} jobs.`);
      setBulkOpen(false);
      setSelected(new Set());
      void refetch();
    } catch (err) {
      toast.error(`Bulk assign failed: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const hasServiceCode = serviceCode.trim().length > 0;

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Occurrence Status"
        description="Drill-down for a specific service in the current season"
      />

      <ReportFilters
        actions={
          <>
            {selected.size > 0 ? (
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                Bulk Assign ({selected.size})
              </Button>
            ) : null}
            <CsvExportButton
              endpoint="/v1/reports/occurrence-status"
              params={params}
              filename={`occurrence-status-${serviceCode || 'all'}-${seasonYear}.csv`}
              disabled={!hasServiceCode}
            />
          </>
        }
      >
        <Input
          placeholder="Service code (e.g. FERT)"
          value={serviceCode}
          onChange={(e) => setServiceCode(e.target.value.toUpperCase())}
          className="w-48"
          aria-label="Service code"
        />
        <Input
          type="number"
          min={2020}
          max={2100}
          value={seasonYear}
          onChange={(e) => setSeasonYear(Number(e.target.value))}
          className="w-28"
          aria-label="Season year"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36" aria-label="Status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40" aria-label="Property category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="hoa">HOA</SelectItem>
          </SelectContent>
        </Select>
      </ReportFilters>

      {!hasServiceCode ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Enter a service code to view occurrences.
          </CardContent>
        </Card>
      ) : (
        <>
          <KpiStrip
            columns={4}
            loading={isLoading}
            items={
              data
                ? [
                  { label: 'Pending', value: data.totals.pending, accent: 'text-yellow-600' },
                  { label: 'Assigned', value: data.totals.assigned, accent: 'text-blue-600' },
                  { label: 'Completed', value: data.totals.completed, accent: 'text-green-600' },
                  { label: 'Skipped', value: data.totals.skipped, accent: 'text-red-600' },
                ]
                : []
            }
          />

          <ReportTable
            loading={isLoading}
            error={error}
            empty={data !== undefined && data.rows.length === 0}
            emptyMessage={`No occurrences found for ${data?.service_code ?? serviceCode.trim()}.`}
            errorPrefix="Failed to load"
          >
            {data && data.rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead>Job</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.occurrence_id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.occurrence_id)}
                          onCheckedChange={() => toggle(r.occurrence_id)}
                          aria-label={`Select ${r.customer_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.customer_name}
                        {r.customer_number ? (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({r.customer_number})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{r.street_address ?? '—'}</TableCell>
                      <TableCell className="capitalize">{r.property_category ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>{r.assigned_date ?? '—'}</TableCell>
                      <TableCell>{r.job_number ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </ReportTable>
        </>
      )}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selected.size} occurrence{selected.size === 1 ? '' : 's'} will be scheduled on:
            </p>
            <Input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              aria-label="Bulk assign date"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitBulkAssign} disabled={submitting || !bulkDate}>
              {submitting ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
