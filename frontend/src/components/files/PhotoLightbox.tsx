import { useState, useEffect, useCallback } from 'react';
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
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

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

      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={photo.original_filename}
            className="max-h-[70vh] object-contain"
          />
        )}

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
