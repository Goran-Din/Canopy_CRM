import { useState, useEffect } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

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

  // Fetch download URLs for thumbnails
  useEffect(() => {
    photos.forEach((photo) => {
      if (!thumbnailUrls[photo.id]) {
        apiClient.get(`/v1/files/${photo.id}/download`).then(({ data }) => {
          setThumbnailUrls((prev) => ({ ...prev, [photo.id]: data.download_url }));
        });
      }
    });
  }, [photos]);

  const handleTogglePortal = async (file: FileRecord) => {
    await togglePortal.mutateAsync({ id: file.id, portal_visible: !file.portal_visible });
    refetch();
  };

  return (
    <div className="space-y-4">
      {hasIssuePhotos && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">
            Issue photos require attention
          </span>
        </div>
      )}

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

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={filteredPhotos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onTogglePortal={handleTogglePortal}
        />
      )}

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
