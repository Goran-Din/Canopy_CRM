import { PhotoGrid } from '@/components/files/PhotoGrid';

interface PhotosTabProps {
  jobId: string;
  customerId: string;
}

export function PhotosTab({ jobId, customerId }: PhotosTabProps) {
  return (
    <div className="mt-4">
      <PhotoGrid jobId={jobId} customerId={customerId} />
    </div>
  );
}
