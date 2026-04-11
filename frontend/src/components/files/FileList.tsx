import { useState } from 'react';
import { Download, Trash2, FileText, Image, File, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { formatFileSize, getMimeIcon } from './file-types';
import type { FileRecord } from './file-types';

interface FileListProps {
  customerId: string;
  folderId: string | null;
  isPortal?: boolean;
}

const iconMap: Record<string, typeof File> = {
  FileText,
  Image,
  Table2,
  File,
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FileList({ customerId, folderId, isPortal = false }: FileListProps) {
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);

  const queryParams: Record<string, string> = {};
  if (folderId) queryParams.folder_id = folderId;

  const { data: files = [], refetch } = useApiGet<FileRecord[]>(
    ['files', customerId, folderId ?? 'all'],
    `/v1/customers/${customerId}/files`,
    queryParams,
  );

  const deleteFile = useApiMutation<void, { id: string }>(
    'delete',
    (vars) => `/v1/files/${vars.id}`,
    [['files', customerId]],
  );

  const togglePortalVisibility = useApiMutation<void, { id: string; portal_visible: boolean }>(
    'patch',
    (vars) => `/v1/files/${vars.id}`,
    [['files', customerId]],
  );

  const handleDownload = async (fileId: string) => {
    try {
      const { data } = await apiClient.get(`/v1/files/${fileId}/download`);
      window.open(data.download_url, '_blank');
    } catch {
      toast.error('Failed to download file.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFile.mutateAsync({ id: deleteTarget.id });
      toast.success('File deleted.');
      setDeleteTarget(null);
      refetch();
    } catch {
      toast.error('Failed to delete file.');
    }
  };

  const handleTogglePortal = async (file: FileRecord) => {
    try {
      await togglePortalVisibility.mutateAsync({
        id: file.id,
        portal_visible: !file.portal_visible,
      });
      refetch();
    } catch {
      toast.error('Failed to update visibility.');
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <File className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No files in this folder</p>
        <p className="text-xs text-muted-foreground">Upload a file to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium">Name</th>
              <th className="text-right py-2 px-2 font-medium">Size</th>
              <th className="text-left py-2 px-2 font-medium">Date</th>
              {!isPortal && <th className="text-center py-2 px-2 font-medium">Portal</th>}
              <th className="text-right py-2 px-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const IconName = getMimeIcon(file.mime_type);
              const Icon = iconMap[IconName] || File;
              return (
                <tr key={file.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[200px]">{file.original_filename}</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">
                    {formatDate(file.created_at)}
                  </td>
                  {!isPortal && (
                    <td className="text-center py-2 px-2">
                      <Switch
                        checked={file.portal_visible}
                        onCheckedChange={() => handleTogglePortal(file)}
                        disabled={file.is_signed_document}
                      />
                    </td>
                  )}
                  <td className="text-right py-2 px-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!file.is_signed_document && !isPortal && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete File"
        description={`Delete "${deleteTarget?.original_filename}"? This cannot be undone.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
