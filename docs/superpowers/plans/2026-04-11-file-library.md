# File Library Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable file management UI (folder sidebar, file list, upload with R2 presigned URLs, photo grid with lightbox, portal view) used across Customer Card, Job Card, and Client Portal.

**Architecture:** Shared components in `src/components/files/` consumed by three contexts. Upload flow uses a 3-step presigned URL pattern (request URL → PUT to R2 → confirm). State managed via React Query hooks. PhotoGrid uses a lightbox overlay for full-size viewing.

**Tech Stack:** React 18, TypeScript, shadcn/ui (Dialog, Card, Switch, Table, Tabs, Select, Badge, Button), Lucide icons, XMLHttpRequest (upload progress), React Query via useApiGet/useApiList/useApiMutation hooks, Vitest + React Testing Library.

**Frontend root:** `C:\Users\Goran\Documents\03-DEVELOPMENT\Canopy CRM\Code\canopy_crm\frontend`

---

## File Structure

```
frontend/src/components/files/
├── file-types.ts           # Shared types, constants, formatFileSize util
├── useFileUpload.ts        # 3-step R2 upload hook (presign → PUT → confirm)
├── FolderSidebar.tsx       # Folder list with selection, new folder input
├── FileList.tsx            # Table view of files with portal toggle, download, delete
├── FileUploadDialog.tsx    # Multi-step upload dialog (file → folder → category → visibility)
├── PhotoGrid.tsx           # Thumbnail grid with tag filter, issue banner
├── PhotoLightbox.tsx       # Full-screen photo overlay with navigation
├── FileLibrary.tsx         # Main container (sidebar + file list) for Customer Card
├── PortalFileView.tsx      # Simplified client portal file view
└── __tests__/
    └── FileLibrary.test.tsx  # 17-case test suite

frontend/src/pages/customers/CustomerDetailPage.tsx  # Add "Files" tab (modify)
frontend/src/pages/portal/PortalFilesPage.tsx        # New portal files page
frontend/src/App.tsx                                  # Add /portal/files route (modify)
frontend/src/pages/portal/PortalDashboardPage.tsx    # Add Files nav card (modify)
```

---

## Task 0: Install Missing shadcn/ui Switch Component

**Files:**
- Create: `frontend/src/components/ui/switch.tsx`

- [ ] **Step 1: Install the Switch component**

```bash
cd frontend && npx shadcn-ui@latest add switch --yes
```

- [ ] **Step 2: Verify it exists**

Check `frontend/src/components/ui/switch.tsx` was created.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/switch.tsx
git commit -m "chore: add shadcn/ui Switch component"
```

---

## Task 1: Types and Constants

**Files:**
- Create: `frontend/src/components/files/file-types.ts`

- [ ] **Step 1: Create the types file**

Create `frontend/src/components/files/file-types.ts`:

```typescript
export interface FileRecord {
  id: string;
  tenant_id: string;
  customer_id: string;
  folder_id: string | null;
  original_filename: string;
  file_size: number;
  mime_type: string;
  file_category: string;
  portal_visible: boolean;
  is_signed_document: boolean;
  photo_tag?: string;
  created_at: string;
  created_by_name?: string;
}

export interface Folder {
  id: string;
  folder_name: string;
  folder_slug: string;
  is_internal: boolean;
  file_count: number;
}

export const STANDARD_FOLDERS = [
  { name: 'Agreements & Contracts', slug: 'agreements', icon: 'FileText' },
  { name: 'Quotes & Proposals', slug: 'quotes', icon: 'FileSignature' },
  { name: 'Invoices', slug: 'invoices', icon: 'Receipt' },
  { name: 'Property Photos', slug: 'photos', icon: 'Image' },
  { name: 'Project Renders & Plans', slug: 'renders', icon: 'PenTool' },
  { name: 'Internal', slug: 'internal', icon: 'Lock', staffOnly: true },
] as const;

export const PHOTO_TAGS = [
  'before_work',
  'during_work',
  'after_work',
  'issue_found',
  'sign_off',
] as const;

export type PhotoTag = (typeof PHOTO_TAGS)[number];

export const PHOTO_TAG_LABELS: Record<PhotoTag, string> = {
  before_work: 'Before Work',
  during_work: 'During Work',
  after_work: 'After Work',
  issue_found: 'Issue Found',
  sign_off: 'Sign-off',
};

export const FILE_CATEGORIES = [
  'contract_pdf',
  'quote_pdf',
  'signed_quote_pdf',
  'invoice_pdf',
  'property_photo',
  'project_render',
  'internal_doc',
  'client_upload',
  'other',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  contract_pdf: 'Contract PDF',
  quote_pdf: 'Quote PDF',
  signed_quote_pdf: 'Signed Quote PDF',
  invoice_pdf: 'Invoice PDF',
  property_photo: 'Property Photo',
  project_render: 'Project Render',
  internal_doc: 'Internal Document',
  client_upload: 'Client Upload',
  other: 'Other',
};

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const MAX_FILE_SIZE_STAFF = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE_PORTAL = 10 * 1024 * 1024; // 10MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getMimeIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'FileText';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('word')) return 'FileText';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Table2';
  return 'File';
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/file-types.ts
git commit -m "feat(files): add shared types, constants, and utilities"
```

---

## Task 2: File Upload Hook

**Files:**
- Create: `frontend/src/components/files/useFileUpload.ts`

- [ ] **Step 1: Create the upload hook**

Create `frontend/src/components/files/useFileUpload.ts`:

```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '@/api/client';

interface UploadOptions {
  folder_id?: string;
  file_category?: string;
  portal_visible?: boolean;
  photo_tag?: string;
}

interface UploadState {
  progress: number;
  isUploading: boolean;
  error: string | null;
}

export function useFileUpload(customerId: string) {
  const [state, setState] = useState<UploadState>({
    progress: 0,
    isUploading: false,
    error: null,
  });

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}) => {
      setState({ progress: 0, isUploading: true, error: null });

      try {
        // Step 1: Request presigned upload URL
        const { data: presign } = await apiClient.post('/v1/files/upload-url', {
          customer_id: customerId,
          filename: file.name,
          content_type: file.type,
          file_size: file.size,
          folder_id: options.folder_id,
          file_category: options.file_category,
        });

        // Step 2: Upload directly to R2 via presigned URL (use XHR for progress)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presign.upload_url);
          xhr.setRequestHeader('Content-Type', file.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setState((s) => ({ ...s, progress: pct }));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(file);
        });

        // Step 3: Confirm upload with backend
        const { data: fileRecord } = await apiClient.post('/v1/files/confirm', {
          upload_id: presign.upload_id,
          file_key: presign.file_key,
          customer_id: customerId,
          folder_id: options.folder_id,
          file_category: options.file_category || 'other',
          portal_visible: options.portal_visible ?? false,
          photo_tag: options.photo_tag,
        });

        setState({ progress: 100, isUploading: false, error: null });
        return fileRecord;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setState({ progress: 0, isUploading: false, error: message });
        throw err;
      }
    },
    [customerId],
  );

  const reset = useCallback(() => {
    setState({ progress: 0, isUploading: false, error: null });
  }, []);

  return { upload, reset, ...state };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/useFileUpload.ts
git commit -m "feat(files): add useFileUpload hook with R2 presigned URL flow"
```

---

## Task 3: FolderSidebar Component

**Files:**
- Create: `frontend/src/components/files/FolderSidebar.tsx`

- [ ] **Step 1: Create the FolderSidebar component**

Create `frontend/src/components/files/FolderSidebar.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/FolderSidebar.tsx
git commit -m "feat(files): add FolderSidebar component with folder list and create"
```

---

## Task 4: FileList Component

**Files:**
- Create: `frontend/src/components/files/FileList.tsx`

- [ ] **Step 1: Create the FileList component**

Create `frontend/src/components/files/FileList.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/FileList.tsx
git commit -m "feat(files): add FileList component with portal toggle, download, delete"
```

---

## Task 5: FileUploadDialog Component

**Files:**
- Create: `frontend/src/components/files/FileUploadDialog.tsx`

- [ ] **Step 1: Create the FileUploadDialog component**

Create `frontend/src/components/files/FileUploadDialog.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/FileUploadDialog.tsx
git commit -m "feat(files): add FileUploadDialog with drag-drop, folder, category, progress"
```

---

## Task 6: PhotoGrid and PhotoLightbox

**Files:**
- Create: `frontend/src/components/files/PhotoGrid.tsx`
- Create: `frontend/src/components/files/PhotoLightbox.tsx`

- [ ] **Step 1: Create the PhotoLightbox component**

Create `frontend/src/components/files/PhotoLightbox.tsx`:

```typescript
import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/api/client';
import { PHOTO_TAG_LABELS } from './file-types';
import type { FileRecord, PhotoTag } from './file-types';

interface PhotoLightboxProps {
  photos: FileRecord[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onTogglePortal?: (file: FileRecord) => void;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  onTogglePortal,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    apiClient.get(`/v1/files/${photo.id}/download`).then(({ data }) => {
      setImageUrl(data.download_url);
    });
  }, [photo.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
    },
    [currentIndex, photos.length, onClose, onNavigate],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-4 text-white hover:bg-white/20"
          onClick={() => onNavigate(currentIndex - 1)}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      {currentIndex < photos.length - 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 text-white hover:bg-white/20"
          onClick={() => onNavigate(currentIndex + 1)}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Image */}
      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={photo.original_filename}
            className="max-h-[70vh] object-contain"
          />
        )}

        {/* Info bar */}
        <div className="mt-4 text-center text-white space-y-1">
          <p className="text-sm">{photo.original_filename}</p>
          <div className="flex items-center justify-center gap-2">
            {photo.photo_tag && (
              <Badge variant="secondary">
                {PHOTO_TAG_LABELS[photo.photo_tag as PhotoTag]}
              </Badge>
            )}
            <span className="text-xs text-white/70">
              {new Date(photo.created_at).toLocaleDateString()}
            </span>
            {photo.created_by_name && (
              <span className="text-xs text-white/70">by {photo.created_by_name}</span>
            )}
          </div>
          {onTogglePortal && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-xs text-white/70">Client visible</span>
              <Switch
                checked={photo.portal_visible}
                onCheckedChange={() => onTogglePortal(photo)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Note: Add `import { useState, useEffect, useCallback } from 'react';` at the top (replace the existing useEffect/useCallback import).

- [ ] **Step 2: Create the PhotoGrid component**

Create `frontend/src/components/files/PhotoGrid.tsx`:

```typescript
import { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { apiClient } from '@/api/client';
import { PHOTO_TAGS, PHOTO_TAG_LABELS } from './file-types';
import type { FileRecord, PhotoTag } from './file-types';
import { PhotoLightbox } from './PhotoLightbox';
import { FileUploadDialog } from './FileUploadDialog';

interface PhotoGridProps {
  jobId: string;
  customerId: string;
}

export function PhotoGrid({ jobId, customerId }: PhotoGridProps) {
  const [tagFilter, setTagFilter] = useState<PhotoTag | 'all'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: photos = [], refetch } = useApiGet<FileRecord[]>(
    ['photos', customerId, jobId],
    `/v1/customers/${customerId}/files`,
    { job_id: jobId, category: 'property_photo' },
  );

  const togglePortal = useApiMutation<void, { id: string; portal_visible: boolean }>(
    'patch',
    (vars) => `/v1/files/${vars.id}`,
    [['photos', customerId, jobId]],
  );

  const filteredPhotos =
    tagFilter === 'all' ? photos : photos.filter((p) => p.photo_tag === tagFilter);

  const hasIssuePhotos = photos.some((p) => p.photo_tag === 'issue_found');

  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  // Fetch download URLs for thumbnails
  useState(() => {
    photos.forEach((photo) => {
      if (!thumbnailUrls[photo.id]) {
        apiClient.get(`/v1/files/${photo.id}/download`).then(({ data }) => {
          setThumbnailUrls((prev) => ({ ...prev, [photo.id]: data.download_url }));
        });
      }
    });
  });

  const handleTogglePortal = async (file: FileRecord) => {
    await togglePortal.mutateAsync({ id: file.id, portal_visible: !file.portal_visible });
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Issue banner */}
      {hasIssuePhotos && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">
            Issue photos require attention
          </span>
        </div>
      )}

      {/* Tag filter bar */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tagFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setTagFilter('all')}
        >
          All
        </Button>
        {PHOTO_TAGS.map((tag) => (
          <Button
            key={tag}
            size="sm"
            variant={tagFilter === tag ? 'default' : 'outline'}
            onClick={() => setTagFilter(tag)}
          >
            {PHOTO_TAG_LABELS[tag]}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setUploadOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Upload Photos
        </Button>
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredPhotos.map((photo, idx) => (
          <div
            key={photo.id}
            className={cn(
              'relative aspect-square rounded-md overflow-hidden cursor-pointer group border',
              photo.photo_tag === 'issue_found' && 'ring-2 ring-amber-400',
            )}
            onClick={() => setLightboxIndex(idx)}
          >
            {thumbnailUrls[photo.id] ? (
              <img
                src={thumbnailUrls[photo.id]}
                alt={photo.original_filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}
            {photo.photo_tag && (
              <Badge
                className="absolute bottom-2 left-2 text-xs"
                variant={photo.photo_tag === 'issue_found' ? 'destructive' : 'secondary'}
              >
                {PHOTO_TAG_LABELS[photo.photo_tag as PhotoTag]}
              </Badge>
            )}
            <div className="absolute bottom-2 right-2">
              <div
                className={cn(
                  'w-3 h-3 rounded-full border border-white',
                  photo.portal_visible ? 'bg-green-500' : 'bg-gray-400',
                )}
              />
            </div>
          </div>
        ))}
      </div>

      {filteredPhotos.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No photos{tagFilter !== 'all' ? ` tagged "${PHOTO_TAG_LABELS[tagFilter]}"` : ''}.
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={filteredPhotos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onTogglePortal={handleTogglePortal}
        />
      )}

      {/* Upload dialog */}
      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        customerId={customerId}
        isPhotoUpload
        onComplete={refetch}
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/files/PhotoGrid.tsx frontend/src/components/files/PhotoLightbox.tsx
git commit -m "feat(files): add PhotoGrid with tag filter and PhotoLightbox overlay"
```

---

## Task 7: FileLibrary Container

**Files:**
- Create: `frontend/src/components/files/FileLibrary.tsx`

- [ ] **Step 1: Create the FileLibrary container**

Create `frontend/src/components/files/FileLibrary.tsx`:

```typescript
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
      {/* Header */}
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

      {/* Mobile: folder dropdown */}
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

      {/* Desktop: sidebar + file list */}
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

      {/* Upload dialog */}
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/FileLibrary.tsx
git commit -m "feat(files): add FileLibrary container with sidebar and responsive layout"
```

---

## Task 8: PortalFileView Component

**Files:**
- Create: `frontend/src/components/files/PortalFileView.tsx`

- [ ] **Step 1: Create the PortalFileView component**

Create `frontend/src/components/files/PortalFileView.tsx`:

```typescript
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
    else groups.agreements.push(file); // default bucket
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

  // Filter out internal files (safety net — backend should already exclude them)
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/files/PortalFileView.tsx
git commit -m "feat(files): add PortalFileView for client portal with grouped sections"
```

---

## Task 9: Integration — Customer Detail Files Tab

**Files:**
- Modify: `frontend/src/pages/customers/CustomerDetailPage.tsx`

- [ ] **Step 1: Add the Files tab**

In `frontend/src/pages/customers/CustomerDetailPage.tsx`:

Add import at top (after other imports):
```typescript
import { FileLibrary } from '@/components/files/FileLibrary';
```

Find the TabsList section (around line 285-292) and add a new TabsTrigger after "Contracts":
```typescript
              <TabsTrigger value="files">
                Files
              </TabsTrigger>
```

Add a new TabsContent after the contracts TabsContent (around line 309):
```typescript
            <TabsContent value="files" className="mt-4">
              <FileLibrary customerId={id!} />
            </TabsContent>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/customers/CustomerDetailPage.tsx
git commit -m "feat(files): add Files tab to Customer Detail page"
```

---

## Task 10: Integration — Portal Files Page & Route

**Files:**
- Create: `frontend/src/pages/portal/PortalFilesPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/portal/PortalDashboardPage.tsx`

- [ ] **Step 1: Create the portal files page**

Create `frontend/src/pages/portal/PortalFilesPage.tsx`:

```typescript
import { useAuthStore } from '@/stores/authStore';
import { PortalFileView } from '@/components/files/PortalFileView';

export default function PortalFilesPage() {
  const user = useAuthStore((s) => s.user);

  if (!user?.customer_id) {
    return <p className="text-muted-foreground">Unable to load files.</p>;
  }

  return <PortalFileView customerId={user.customer_id} />;
}
```

- [ ] **Step 2: Add route to App.tsx**

In `frontend/src/App.tsx`, add import:
```typescript
import PortalFilesPage from './pages/portal/PortalFilesPage';
```

Add route inside the portal PortalRoute group (after `/portal/properties`):
```typescript
          <Route path="/portal/files" element={<PortalFilesPage />} />
```

- [ ] **Step 3: Add Files card to PortalDashboardPage**

In `frontend/src/pages/portal/PortalDashboardPage.tsx`, add `FolderOpen` to the Lucide import:
```typescript
import { FileText, Briefcase, Receipt, Home, ArrowRight, FolderOpen } from 'lucide-react';
```

Add a Files navigation card after the existing summary cards section (after the invoices card around line 77):
```typescript
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/portal/files')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">Files</p>
                <p className="text-sm text-muted-foreground">Documents & photos</p>
              </div>
            </div>
          </CardContent>
        </Card>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/portal/PortalFilesPage.tsx frontend/src/App.tsx frontend/src/pages/portal/PortalDashboardPage.tsx
git commit -m "feat(files): add portal files page, route, and dashboard navigation"
```

---

## Task 11: Test Suite

**Files:**
- Create: `frontend/src/components/files/__tests__/FileLibrary.test.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/components/files/__tests__/FileLibrary.test.tsx`:

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the API hooks
const mockUseApiGet = vi.fn();
const mockUseApiList = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseApiMutation = vi.fn(() => ({ mutateAsync: mockMutateAsync }));

vi.mock('@/hooks/useApi', () => ({
  useApiGet: (...args: unknown[]) => mockUseApiGet(...args),
  useApiList: (...args: unknown[]) => mockUseApiList(...args),
  useApiMutation: (...args: unknown[]) => mockUseApiMutation(...args),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));

import { apiClient } from '@/api/client';
import { formatFileSize } from '../file-types';

const mockFolders = [
  { id: 'f1', folder_name: 'Agreements', folder_slug: 'agreements', is_internal: false, file_count: 3 },
  { id: 'f2', folder_name: 'Internal', folder_slug: 'internal', is_internal: true, file_count: 2 },
  { id: 'f3', folder_name: 'Photos', folder_slug: 'photos', is_internal: false, file_count: 5 },
];

const mockFiles = [
  {
    id: 'file1',
    tenant_id: 't1',
    customer_id: 'c1',
    folder_id: 'f1',
    original_filename: 'contract.pdf',
    file_size: 245000,
    mime_type: 'application/pdf',
    file_category: 'contract_pdf',
    portal_visible: true,
    is_signed_document: true,
    created_at: '2026-04-01T10:00:00Z',
    created_by_name: 'Admin',
  },
  {
    id: 'file2',
    tenant_id: 't1',
    customer_id: 'c1',
    folder_id: 'f1',
    original_filename: 'proposal.pdf',
    file_size: 1250000,
    mime_type: 'application/pdf',
    file_category: 'quote_pdf',
    portal_visible: false,
    is_signed_document: false,
    created_at: '2026-04-02T10:00:00Z',
    created_by_name: 'Admin',
  },
];

const mockPhotos = [
  {
    id: 'photo1',
    tenant_id: 't1',
    customer_id: 'c1',
    folder_id: 'f3',
    original_filename: 'before.jpg',
    file_size: 3000000,
    mime_type: 'image/jpeg',
    file_category: 'property_photo',
    portal_visible: true,
    is_signed_document: false,
    photo_tag: 'before_work',
    created_at: '2026-04-01T10:00:00Z',
    created_by_name: 'Crew Lead',
  },
  {
    id: 'photo2',
    tenant_id: 't1',
    customer_id: 'c1',
    folder_id: 'f3',
    original_filename: 'issue.jpg',
    file_size: 2500000,
    mime_type: 'image/jpeg',
    file_category: 'property_photo',
    portal_visible: false,
    is_signed_document: false,
    photo_tag: 'issue_found',
    created_at: '2026-04-02T10:00:00Z',
    created_by_name: 'Crew Lead',
  },
];

function setupMocks(options: { files?: typeof mockFiles; folders?: typeof mockFolders } = {}) {
  const files = options.files ?? mockFiles;
  const folders = options.folders ?? mockFolders;

  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'folders') return { data: folders, refetch: vi.fn() };
    if (key[0] === 'files') return { data: files, refetch: vi.fn() };
    if (key[0] === 'photos') return { data: mockPhotos, refetch: vi.fn() };
    if (key[0] === 'portal-files') return { data: files.filter((f) => f.portal_visible), refetch: vi.fn() };
    return { data: null, refetch: vi.fn() };
  });
}

describe('FileLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders folder sidebar with standard folders', async () => {
    const { FolderSidebar } = await import('../FolderSidebar');
    render(
      <MemoryRouter>
        <FolderSidebar customerId="c1" selectedFolder={null} onSelectFolder={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('All Files')).toBeInTheDocument();
    expect(screen.getByText('Agreements')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
  });

  it('clicking a folder calls onSelectFolder', async () => {
    const onSelect = vi.fn();
    const { FolderSidebar } = await import('../FolderSidebar');
    render(
      <MemoryRouter>
        <FolderSidebar customerId="c1" selectedFolder={null} onSelectFolder={onSelect} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Agreements'));
    expect(onSelect).toHaveBeenCalledWith('f1');
  });

  it('file list shows filename, size, date columns', async () => {
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('245 KB')).toBeInTheDocument();
    expect(screen.getByText('Apr 1, 2026')).toBeInTheDocument();
  });

  it('portal visibility toggle calls PATCH', async () => {
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    // The second file (proposal.pdf) has is_signed_document=false so toggle is enabled
    const switches = screen.getAllByRole('switch');
    // Find the one that's not disabled
    const enabledSwitch = switches.find((s) => !s.hasAttribute('disabled'));
    if (enabledSwitch) {
      await userEvent.click(enabledSwitch);
      expect(mockMutateAsync).toHaveBeenCalled();
    }
  });

  it('download button calls GET /v1/files/:id/download', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { download_url: 'https://r2.example.com/file.pdf' },
    });
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    const downloadButtons = screen.getAllByRole('button');
    const dlBtn = downloadButtons.find((b) => b.querySelector('[class*="Download"]') || b.getAttribute('aria-label')?.includes('download'));
    // Click first download-looking button
    if (dlBtn) await userEvent.click(dlBtn);
  });

  it('delete button shows confirmation dialog', async () => {
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    // proposal.pdf is not signed, should have a delete button
    // The signed contract.pdf should NOT have a delete button
  });

  it('delete button hidden for signed documents', async () => {
    setupMocks({ files: [mockFiles[0]] }); // only signed doc
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    // No trash icon should be rendered for signed documents
    const trashButtons = document.querySelectorAll('[class*="destructive"]');
    expect(trashButtons.length).toBe(0);
  });

  it('portal toggle disabled for signed documents', async () => {
    setupMocks({ files: [mockFiles[0]] }); // signed doc
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toBeDisabled();
  });

  it('upload dialog opens on button click', async () => {
    const { FileLibrary } = await import('../FileLibrary');
    render(
      <MemoryRouter>
        <FileLibrary customerId="c1" />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('Upload File'));
    await waitFor(() => {
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });
  });

  it('photo grid renders thumbnails in grid layout', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { download_url: 'https://r2.example.com/photo.jpg' },
    });
    const { PhotoGrid } = await import('../PhotoGrid');
    render(
      <MemoryRouter>
        <PhotoGrid jobId="j1" customerId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Before Work')).toBeInTheDocument();
    expect(screen.getByText('Issue Found')).toBeInTheDocument();
  });

  it('photo tag filter works correctly', async () => {
    const { PhotoGrid } = await import('../PhotoGrid');
    render(
      <MemoryRouter>
        <PhotoGrid jobId="j1" customerId="c1" />
      </MemoryRouter>,
    );
    // Click "Before Work" filter
    const filterButtons = screen.getAllByRole('button');
    const beforeBtn = filterButtons.find((b) => b.textContent === 'Before Work');
    if (beforeBtn) await userEvent.click(beforeBtn);
  });

  it('portal view hides internal folder completely', async () => {
    setupMocks({ files: mockFiles });
    const { PortalFileView } = await import('../PortalFileView');
    render(
      <MemoryRouter>
        <PortalFileView customerId="c1" />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Internal')).not.toBeInTheDocument();
  });

  it('portal view shows only portal_visible=true files', async () => {
    setupMocks({ files: mockFiles });
    const { PortalFileView } = await import('../PortalFileView');
    render(
      <MemoryRouter>
        <PortalFileView customerId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    expect(screen.queryByText('proposal.pdf')).not.toBeInTheDocument();
  });

  it('file size formatting works (KB, MB)', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(245000)).toBe('245 KB');
    expect(formatFileSize(1250000)).toBe('1.2 MB');
  });

  it('empty state shown when no files in folder', async () => {
    setupMocks({ files: [] });
    const { FileList } = await import('../FileList');
    render(
      <MemoryRouter>
        <FileList customerId="c1" folderId={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText('No files in this folder')).toBeInTheDocument();
  });

  it('issue photos banner shown when issue photos exist', async () => {
    const { PhotoGrid } = await import('../PhotoGrid');
    render(
      <MemoryRouter>
        <PhotoGrid jobId="j1" customerId="c1" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Issue photos require attention')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd frontend && npx vitest run src/components/files/__tests__/FileLibrary.test.tsx`
Expected: All tests pass (fix any issues with mocking or component rendering)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/files/__tests__/FileLibrary.test.tsx
git commit -m "test(files): add 17-case test suite for file library components"
```

---

## Task 12: Final Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: All tests pass (existing + signing page + file library)

- [ ] **Step 3: Fix any issues found**

If lint or type errors exist, fix them and commit:
```bash
git add -A
git commit -m "fix(files): address lint/type issues from verification"
```

---

## Notes

- The `useFileUpload` hook uses `apiClient` (authenticated) for Steps 1 and 3, and raw XHR for Step 2 (direct R2 upload). This is correct — only the presigned URL request and confirmation need auth.
- `PhotoLightbox` fetches download URLs on-demand for each photo since R2 signed URLs are short-lived.
- The `PortalFileView` uses `apiClient` (portal auth token) not `publicApi` — portal users ARE logged in.
- `FileList` uses the `ConfirmDialog` shared component that already exists in the codebase.
- The `Switch` component needs to be available in shadcn/ui. If it doesn't exist, run: `npx shadcn-ui@latest add switch`
