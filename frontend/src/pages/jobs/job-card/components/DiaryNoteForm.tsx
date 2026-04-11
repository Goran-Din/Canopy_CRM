import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface DiaryNoteFormProps {
  jobId: string;
  onCancel: () => void;
  onSubmitted: () => void;
}

export function DiaryNoteForm({ jobId, onCancel, onSubmitted }: DiaryNoteFormProps) {
  const [content, setContent] = useState('');

  const addNote = useApiMutation<void, { content: string; entry_type: string }>(
    'post',
    `/v1/jobs/${jobId}/diary`,
    [['diary', jobId]],
  );

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await addNote.mutateAsync({ content: content.trim(), entry_type: 'note_added' });
      toast.success('Note added');
      setContent('');
      onSubmitted();
    } catch {
      toast.error('Failed to add note.');
    }
  };

  return (
    <div className="space-y-2 p-3 bg-muted/50 rounded-md">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a note..."
        className="min-h-[80px]"
        autoFocus
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
          Add Note
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
