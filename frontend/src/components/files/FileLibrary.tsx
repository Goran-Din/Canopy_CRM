import { useState } from 'react';
import { ExternalLink, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiGet } from '@/hooks/useApi';
import { FolderSidebar } from './FolderSidebar';
import { FileList } from './FileList';
import { FileUploadDialog } from './FileUploadDialog';
import type { Folder } from './file-types';

interface FileLibraryProps {
  customerId: string;
  googleDriveUrl?: string;
}

export function FileLibrary({ customerId, googleDriveUrl }: FileLibraryProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: folders = [], refetch: refetchFolders } = useApiGet<Folder[]>(
    ['folders', customerId],
    `/v1/customers/${customerId}/folders`,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Files</h3>
        <div className="flex items-center gap-2">
          {googleDriveUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(googleDriveUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Google Drive
            </Button>
          )}
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload File
          </Button>
        </div>
      </div>

      <div className="md:hidden">
        <Select
          value={selectedFolder ?? 'all'}
          onValueChange={(v) => setSelectedFolder(v === 'all' ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Files" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Files</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.is_internal ? '🔒 ' : ''}{f.folder_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-6">
        <div className="hidden md:block w-48 shrink-0">
          <FolderSidebar
            customerId={customerId}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
          />
        </div>
        <div className="flex-1 min-w-0">
          <FileList customerId={customerId} folderId={selectedFolder} />
        </div>
      </div>

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        customerId={customerId}
        currentFolderId={selectedFolder ?? undefined}
        onComplete={() => refetchFolders()}
      />
    </div>
  );
}
