import { useState } from 'react';
import { Download, Trash2, Upload, File, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { formatFileSize, getMimeIcon } from './file-types';
import { FileUploadDialog } from './FileUploadDialog';
import type { FileRecord } from './file-types';

interface PortalFileViewProps {
  customerId: string;
}

const iconMap: Record<string, typeof File> = { FileText, Image, File };

function groupByCategory(files: FileRecord[]) {
  const groups: Record<string, FileRecord[]> = {
    agreements: [],
    quotes: [],
    photos: [],
    uploads: [],
  };

  for (const file of files) {
    if (file.file_category === 'contract_pdf') groups.agreements.push(file);
    else if (file.file_category === 'quote_pdf' || file.file_category === 'signed_quote_pdf')
      groups.quotes.push(file);
    else if (file.file_category === 'property_photo') groups.photos.push(file);
    else if (file.file_category === 'client_upload') groups.uploads.push(file);
    else groups.agreements.push(file);
  }
  return groups;
}

const SECTION_TITLES: Record<string, string> = {
  agreements: 'Agreements & Contracts',
  quotes: 'Quotes & Proposals',
  photos: 'Property Photos',
  uploads: 'My Uploads',
};

export function PortalFileView({ customerId }: PortalFileViewProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);

  const { data: files = [], refetch } = useApiGet<FileRecord[]>(
    ['portal-files', customerId],
    `/v1/customers/${customerId}/files`,
    { portal_visible: 'true' },
  );

  const deleteFile = useApiMutation<void, { id: string }>(
    'delete',
    (vars) => `/v1/files/${vars.id}`,
    [['portal-files', customerId]],
  );

  const handleDownload = async (fileId: string) => {
    try {
      const { data } = await apiClient.get(`/v1/portal/files/${fileId}/download`);
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

  const visibleFiles = files.filter((f) => f.portal_visible);
  const groups = groupByCategory(visibleFiles);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Documents</h2>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Upload a File
        </Button>
      </div>

      {Object.entries(groups).map(([key, sectionFiles]) => {
        if (sectionFiles.length === 0) return null;

        if (key === 'photos') {
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {SECTION_TITLES[key]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sectionFiles.map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-square rounded-md overflow-hidden bg-muted cursor-pointer"
                      onClick={() => handleDownload(photo.id)}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                {SECTION_TITLES[key]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sectionFiles.map((file) => {
                  const IconName = getMimeIcon(file.mime_type);
                  const Icon = iconMap[IconName] || File;
                  const isClientUpload = file.file_category === 'client_upload';
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{file.original_filename}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.file_size)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(file.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {isClientUpload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(file)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {visibleFiles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No documents available yet.</p>
        </div>
      )}

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        customerId={customerId}
        isPortal
        onComplete={refetch}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete File"
        description={`Delete "${deleteTarget?.original_filename}"? This cannot be undone.`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
