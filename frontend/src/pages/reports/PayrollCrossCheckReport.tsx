/**
 * R-GPS-02 — Payroll Cross-Check report (OWNER ONLY).
 *
 * Compares Layer 1 (clocked time_entries) to Layer 2 (summed GPS dwell) per
 * crew-member per day. Informational only — does not adjust payroll.
 *
 * Flow:
 *   1. Client-side role guard redirects non-owners to /reports with a toast.
 *   2. Required from_date + to_date filters.
 *   3. KPI strip: Days reviewed / Flagged / Consistent.
 *   4. Informational banner with the "not used to adjust pay" copy mandated by spec.
 *   5. Table with status badge + Resolve action on flagged rows.
 *   6. Resolve modal → POST /resolve with a note; refetches on success.
 *   7. CSV export.
 */
import { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useApiGet } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/authStore';
import {
  resolvePayrollCrossCheck,
  type PayrollCrossCheckResponse,
  type PayrollCrossCheckRow,
} from '@/api/reports-v2';
import { CsvExportButton } from './_components/CsvExportButton';
import { ReportHeader } from './_components/ReportHeader';
import { ReportFilters } from './_components/ReportFilters';
import { KpiStrip } from './_components/KpiStrip';
import { ReportTable } from './_components/ReportTable';

const STATUS_ALL = '__all__';

function statusTone(status: PayrollCrossCheckRow['status']): string {
  if (status === 'flagged') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'reviewed') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_FROM = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return toIsoDate(d);
})();
const DEFAULT_TO = toIsoDate(new Date());

export default function PayrollCrossCheckReport() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.roles.some((r) => r.role === 'owner') ?? false;

  useEffect(() => {
    if (user && !isOwner) {
      toast.error('This report is owner-only.');
      navigate('/reports', { replace: true });
    }
  }, [user, isOwner, navigate]);

  const [fromDate, setFromDate] = useState(DEFAULT_FROM);
  const [toDate, setToDate] = useState(DEFAULT_TO);
  const [status, setStatus] = useState(STATUS_ALL);
  const [resolving, setResolving] = useState<PayrollCrossCheckRow | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, unknown> = { from_date: fromDate, to_date: toDate };
    if (status !== STATUS_ALL) p.status = status;
    return p;
  }, [fromDate, toDate, status]);

  const { data, isLoading, error, refetch } = useApiGet<PayrollCrossCheckResponse>(
    ['report-payroll-cross-check', fromDate, toDate, status],
    '/v1/reports/payroll-cross-check',
    params,
    { enabled: isOwner, staleTime: 60_000 },
  );

  if (!isOwner) return null;

  const submitResolve = async () => {
    if (!resolving?.gps_event_id || !resolveNote.trim()) return;
    setSubmitting(true);
    try {
      await resolvePayrollCrossCheck(resolving.gps_event_id, resolveNote.trim());
      toast.success('Cross-check marked as reviewed.');
      setResolving(null);
      setResolveNote('');
      void refetch();
    } catch (err) {
      toast.error(`Failed to resolve: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Payroll Cross-Check"
        description="Layer 1 (clocked time) vs Layer 2 (GPS dwell) comparison"
      />

      {/* Mandated informational banner (I-3 v2 §2) */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 pb-4 flex gap-3 items-start">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            This report is <strong>informational only</strong>. Payroll is always calculated
            from clocked time entries. The Resolve action records a supervisor note and does
            not adjust pay.
          </p>
        </CardContent>
      </Card>

      <ReportFilters
        actions={
          <CsvExportButton
            endpoint="/v1/reports/payroll-cross-check"
            params={params}
            filename={`payroll-cross-check-${fromDate}-to-${toDate}.csv`}
            disabled={isLoading}
          />
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Status filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="consistent">Consistent</SelectItem>
          </SelectContent>
        </Select>
      </ReportFilters>

      <KpiStrip
        columns={3}
        loading={isLoading}
        items={
          data
            ? [
              { label: 'Days reviewed', value: data.totals.days_reviewed },
              { label: 'Flagged', value: data.totals.flagged_count, accent: 'text-red-600' },
              { label: 'Consistent', value: data.totals.consistent_count, accent: 'text-green-600' },
            ]
            : []
        }
      />

      <ReportTable
        loading={isLoading}
        error={error}
        empty={data !== undefined && data.rows.length === 0}
        emptyMessage="No time entries in this range."
        errorPrefix="Failed to load cross-check"
      >
        {data && data.rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Crew Member</TableHead>
                <TableHead className="text-right">Clocked (min)</TableHead>
                <TableHead className="text-right">GPS Dwell (min)</TableHead>
                <TableHead className="text-right">Diff</TableHead>
                <TableHead className="text-right">Diff %</TableHead>
                <TableHead className="text-right">Properties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={`${r.work_date}-${r.user_id}`}>
                  <TableCell>{r.work_date}</TableCell>
                  <TableCell className="font-medium">{r.crew_member}</TableCell>
                  <TableCell className="text-right">{r.layer1_minutes}</TableCell>
                  <TableCell className="text-right">{r.layer2_minutes}</TableCell>
                  <TableCell className="text-right">
                    {r.diff_minutes > 0 ? '+' : ''}
                    {r.diff_minutes}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.diff_pct === null ? '—' : `${r.diff_pct}%`}
                  </TableCell>
                  <TableCell className="text-right">{r.properties_visited}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusTone(r.status)}>
                      {r.status === 'flagged' ? <AlertTriangle className="h-3 w-3 mr-1" /> : null}
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === 'flagged' && r.gps_event_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setResolving(r); setResolveNote(''); }}
                      >
                        Resolve
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </ReportTable>

      <Dialog open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve cross-check flag</DialogTitle>
            <DialogDescription>
              Add a supervisor note explaining the difference. This is recorded for audit but
              does not change payroll.
            </DialogDescription>
          </DialogHeader>
          {resolving ? (
            <div className="space-y-3">
              <div className="text-sm space-y-1 bg-muted/40 rounded p-3">
                <p><strong>Date:</strong> {resolving.work_date}</p>
                <p><strong>Crew Member:</strong> {resolving.crew_member}</p>
                <p>
                  <strong>Clocked / GPS:</strong> {resolving.layer1_minutes} /{' '}
                  {resolving.layer2_minutes} min (diff {resolving.diff_minutes})
                </p>
              </div>
              <Textarea
                placeholder="Supervisor note…"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={4}
                aria-label="Resolve note"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitResolve} disabled={!resolveNote.trim() || submitting}>
              {submitting ? 'Submitting…' : 'Mark Reviewed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
