import { useState } from 'react';
import { FolderOpen, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import type { Folder } from './file-types';

interface FolderSidebarProps {
  customerId: string;
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

export function FolderSidebar({ customerId, selectedFolder, onSelectFolder }: FolderSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const { data: folders = [] } = useApiGet<Folder[]>(
    ['folders', customerId],
    `/v1/customers/${customerId}/folders`,
  );

  const createFolder = useApiMutation<Folder, { folder_name: string }>(
    'post',
    `/v1/customers/${customerId}/folders`,
    [['folders', customerId]],
  );

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    await createFolder.mutateAsync({ folder_name: newFolderName.trim() });
    setNewFolderName('');
    setIsCreating(false);
  };

  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          selectedFolder === null
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted',
        )}
      >
        <FolderOpen className="h-4 w-4" />
        All Files
      </button>

      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onSelectFolder(folder.id)}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
            selectedFolder === folder.id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted',
          )}
        >
          <span className="flex items-center gap-2">
            {folder.is_internal ? (
              <Lock className="h-4 w-4" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            <span className="truncate">{folder.folder_name}</span>
          </span>
          <span className="text-xs opacity-70">{folder.file_count}</span>
        </button>
      ))}

      {isCreating ? (
        <div className="flex gap-1 px-1 pt-2">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <Button size="sm" className="h-8" onClick={handleCreate}>
            Add
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          New Folder
        </button>
      )}
    </div>
  );
}
