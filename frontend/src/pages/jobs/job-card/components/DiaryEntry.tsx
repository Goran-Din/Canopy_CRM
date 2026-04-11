import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DiaryEntryData {
  id: string;
  entry_type: string;
  content: string;
  created_by_name: string | null;
  created_at: string;
}

interface DiaryEntryProps {
  entry: DiaryEntryData;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function DiaryEntry({ entry }: DiaryEntryProps) {
  const isSystem = entry.entry_type === 'system' || !entry.created_by_name;

  return (
    <div className={cn('flex gap-3 py-3 border-b last:border-0', isSystem && 'opacity-70')}>
      <div className="shrink-0 mt-0.5">
        {isSystem ? (
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {entry.created_by_name?.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {!isSystem && entry.created_by_name && (
            <span className="text-sm font-medium">{entry.created_by_name}:</span>
          )}
          <span className="text-xs text-muted-foreground">{formatRelativeTime(entry.created_at)}</span>
        </div>
        <p className={cn('text-sm mt-0.5', isSystem ? 'text-muted-foreground' : '')}>{entry.content}</p>
      </div>
    </div>
  );
}
