import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet } from '@/hooks/useApi';

interface HistoryEntry {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_name: string;
  notes: string | null;
  created_at: string;
}

interface HistoryTabProps {
  jobId: string;
}

export function HistoryTab({ jobId }: HistoryTabProps) {
  const { data: entries = [] } = useApiGet<HistoryEntry[]>(
    ['job-history', jobId],
    `/v1/jobs/${jobId}/history`,
  );

  if (entries.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">No status changes recorded.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Date</th>
            <th className="text-left py-2 font-medium">From</th>
            <th className="text-left py-2 font-medium">To</th>
            <th className="text-left py-2 font-medium">Changed By</th>
            <th className="text-left py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="py-2">{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td className="py-2"><StatusBadge status={entry.from_status} /></td>
              <td className="py-2"><StatusBadge status={entry.to_status} /></td>
              <td className="py-2">{entry.changed_by_name}</td>
              <td className="py-2 text-muted-foreground">{entry.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
