import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiGet } from '@/hooks/useApi';
import { DiaryEntry, type DiaryEntryData } from '../components/DiaryEntry';
import { DiaryNoteForm } from '../components/DiaryNoteForm';

interface DiaryTabProps {
  jobId: string;
}

export function DiaryTab({ jobId }: DiaryTabProps) {
  const [showForm, setShowForm] = useState(false);

  const { data: entries = [], refetch } = useApiGet<DiaryEntryData[]>(
    ['diary', jobId],
    `/v1/jobs/${jobId}/diary`,
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Diary</h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        )}
      </div>

      {showForm && (
        <DiaryNoteForm
          jobId={jobId}
          onCancel={() => setShowForm(false)}
          onSubmitted={() => { setShowForm(false); refetch(); }}
        />
      )}

      <div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No diary entries yet.</p>
        ) : (
          entries.map((entry) => <DiaryEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
