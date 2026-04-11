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
