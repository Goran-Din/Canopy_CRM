import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useApiGet } from '@/hooks/useApi';
import { useFileUpload } from './useFileUpload';
import {
  ALLOWED_MIME_TYPES,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  PHOTO_TAGS,
  PHOTO_TAG_LABELS,
  MAX_FILE_SIZE_STAFF,
  MAX_FILE_SIZE_PORTAL,
  formatFileSize,
} from './file-types';
import type { Folder, FileCategory, PhotoTag } from './file-types';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  currentFolderId?: string;
  isPhotoUpload?: boolean;
  isPortal?: boolean;
  onComplete: () => void;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  customerId,
  currentFolderId,
  isPhotoUpload = false,
  isPortal = false,
  onComplete,
}: FileUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState<string>(currentFolderId || '');
  const [category, setCategory] = useState<FileCategory>(isPhotoUpload ? 'property_photo' : 'other');
  const [photoTag, setPhotoTag] = useState<PhotoTag>('before_work');
  const [portalVisible, setPortalVisible] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const { upload, progress, isUploading } = useFileUpload(customerId);
  const maxSize = isPortal ? MAX_FILE_SIZE_PORTAL : MAX_FILE_SIZE_STAFF;

  const { data: folders = [] } = useApiGet<Folder[]>(
    ['folders', customerId],
    `/v1/customers/${customerId}/folders`,
  );

  const selectedFolderIsInternal = folders.find((f) => f.id === folderId)?.is_internal ?? false;

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    setFileError(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setFileError('File type not allowed. Please use images, PDF, Word, or Excel files.');
      return;
    }
    if (file.size > maxSize) {
      setFileError(`File too large. Maximum size is ${formatFileSize(maxSize)}.`);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      await upload(selectedFile, {
        folder_id: folderId || undefined,
        file_category: category,
        portal_visible: selectedFolderIsInternal ? false : portalVisible,
        photo_tag: isPhotoUpload ? photoTag : undefined,
      });
      toast.success('File uploaded');
      onComplete();
      handleClose();
    } catch {
      toast.error('Upload failed. Please try again.');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileError(null);
    setFolderId(currentFolderId || '');
    setCategory(isPhotoUpload ? 'property_photo' : 'other');
    setPortalVisible(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isPhotoUpload ? 'Upload Photo' : 'Upload File'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File selection */}
          {!selectedFile ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Drag and drop or click to choose a file
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max {formatFileSize(maxSize)}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_MIME_TYPES.join(',')}
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div className="truncate">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {fileError && (
            <p className="text-sm text-destructive">{fileError}</p>
          )}

          {selectedFile && (
            <>
              {/* Folder selection */}
              {!isPhotoUpload && (
                <div className="space-y-2">
                  <Label>Folder</Label>
                  <Select value={folderId} onValueChange={setFolderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.is_internal ? '🔒 ' : ''}{f.folder_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Category / photo tag */}
              {isPhotoUpload ? (
                <div className="space-y-2">
                  <Label>Photo Tag</Label>
                  <Select value={photoTag} onValueChange={(v) => setPhotoTag(v as PhotoTag)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTO_TAGS.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {PHOTO_TAG_LABELS[tag]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as FileCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {FILE_CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Portal visibility */}
              <div className="flex items-center justify-between">
                <Label>Share with client</Label>
                {selectedFolderIsInternal ? (
                  <p className="text-xs text-muted-foreground">Internal files are never visible to clients</p>
                ) : (
                  <Switch
                    checked={portalVisible}
                    onCheckedChange={setPortalVisible}
                  />
                )}
              </div>
            </>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? `Uploading ${progress}%` : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
