import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileList } from '@/components/files/FileList';
import { FileUploadDialog } from '@/components/files/FileUploadDialog';

interface FilesTabProps {
  jobId: string;
  customerId: string;
}

export function FilesTab({ jobId, customerId }: FilesTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Files</h3>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Upload File
        </Button>
      </div>

      <FileList customerId={customerId} folderId={null} />

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        customerId={customerId}
        onComplete={() => {}}
      />
    </div>
  );
}
