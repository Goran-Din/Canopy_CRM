import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CheckCircle2, Circle, Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/useTranslation';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

interface ChecklistItem {
  task: string;
  completed: boolean;
}

interface Photo {
  id: string;
  url: string;
  photo_type: string;
  uploaded_at: string;
}

interface JobDetail {
  id: string;
  property_name: string;
  property_address: string;
  service_type: string;
  status: string;
  scheduled_date: string;
  notes: string | null;
  crew_notes: string | null;
  checklist: ChecklistItem[];
  photos: Photo[];
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  completed: 'bg-green-500',
};

export default function CrewJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<string>('before');
  const [crewNotes, setCrewNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);

  const { data: job, isLoading } = useApiGet<JobDetail>(
    ['crew-job', id],
    `/v1/crew/jobs/${id}`,
    undefined,
    {
      enabled: !!id,
      onSuccess: (data: JobDetail) => {
        if (!notesLoaded) {
          setCrewNotes(data.crew_notes ?? '');
          setNotesLoaded(true);
        }
      },
    } as never,
  );

  const statusMut = useApiMutation(
    'put',
    `/v1/crew/jobs/${id}/status`,
    [['crew-job', id], ['crew-dashboard']],
  );

  const checklistMut = useApiMutation(
    'patch',
    `/v1/crew/jobs/${id}/checklist`,
    [['crew-job', id]],
  );

  const notesMut = useApiMutation(
    'patch',
    `/v1/crew/jobs/${id}/notes`,
    [['crew-job', id]],
  );

  const changeStatus = (status: string) => {
    statusMut.mutate({ status } as never, {
      onSuccess: () => toast.success(status === 'in_progress' ? t.startJob : t.completeJob),
      onError: () => toast.error('Failed'),
    });
  };

  const toggleChecklist = (index: number) => {
    if (!job) return;
    const updated = job.checklist.map((item, i) =>
      i === index ? { ...item, completed: !item.completed } : item,
    );
    checklistMut.mutate({ checklist: updated } as never, {
      onError: () => toast.error('Failed'),
    });
  };

  const saveNotes = () => {
    notesMut.mutate({ crew_notes: crewNotes } as never, {
      onSuccess: () => toast.success(t.save),
      onError: () => toast.error('Failed'),
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('photo_type', photoType);
    try {
      await apiClient.post(`/v1/crew/jobs/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t.addPhoto);
    } catch {
      toast.error('Upload failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerUpload = (type: string) => {
    setPhotoType(type);
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{t.noData}</p>
        <Button variant="link" onClick={() => navigate('/crew/dashboard')}>{t.back}</Button>
      </div>
    );
  }

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(job.property_address)}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crew/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{job.property_name}</h1>
          <p className="text-sm text-muted-foreground truncate">{job.service_type?.replace(/_/g, ' ')}</p>
        </div>
        <div className={`h-3 w-3 rounded-full ${statusColors[job.status] ?? 'bg-gray-400'}`} />
      </div>

      {/* Address + Maps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm">{job.property_address}</p>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm" className="h-10">
                <MapPin className="mr-1 h-4 w-4" />
                {t.openInMaps}
              </Button>
            </a>
          </div>
          {job.notes && (
            <p className="mt-3 text-sm text-muted-foreground border-t pt-3">{job.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Status Actions */}
      <div className="flex gap-3">
        {job.status === 'scheduled' && (
          <Button
            className="flex-1 h-14 text-lg font-bold"
            onClick={() => changeStatus('in_progress')}
            disabled={statusMut.isPending}
          >
            {t.startJob}
          </Button>
        )}
        {job.status === 'in_progress' && (
          <Button
            className="flex-1 h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
            onClick={() => changeStatus('completed')}
            disabled={statusMut.isPending}
          >
            {t.completeJob}
          </Button>
        )}
      </div>

      {/* Checklist */}
      {job.checklist?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.jobChecklist}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {job.checklist.map((item, idx) => (
                <button
                  key={idx}
                  className="flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                  onClick={() => toggleChecklist(idx)}
                  disabled={checklistMut.isPending}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`text-base ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {item.task}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.photos}</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Button
              variant="outline"
              className="h-14 flex-col gap-1"
              onClick={() => triggerUpload('before')}
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">{t.beforePhoto}</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1"
              onClick={() => triggerUpload('during')}
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">{t.duringPhoto}</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1"
              onClick={() => triggerUpload('after')}
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">{t.afterPhoto}</span>
            </Button>
          </div>
          {job.photos?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {job.photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.url}
                    alt={photo.photo_type}
                    className="h-24 w-full rounded-md object-cover"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white capitalize">
                    {photo.photo_type}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!job.photos?.length && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span>{t.addPhoto}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.notes}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={crewNotes}
            onChange={(e) => setCrewNotes(e.target.value)}
            placeholder={t.enterNotes}
            className="min-h-[100px] text-base"
          />
          <Button
            className="mt-2 w-full h-12"
            variant="outline"
            onClick={saveNotes}
            disabled={notesMut.isPending}
          >
            {t.saveNotes}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
