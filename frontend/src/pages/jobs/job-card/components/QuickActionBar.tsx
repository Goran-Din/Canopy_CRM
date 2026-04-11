import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { useState } from 'react';

interface QuickActionBarProps {
  jobId: string;
  status: string;
  onStatusChange: () => void;
}

const STATUS_ACTIONS: Record<string, { label: string; newStatus: string; destructive?: boolean }[]> = {
  lead: [
    { label: 'Convert to Job', newStatus: 'unscheduled' },
    { label: 'Decline', newStatus: 'cancelled', destructive: true },
  ],
  unscheduled: [
    { label: 'Schedule', newStatus: 'scheduled' },
  ],
  scheduled: [
    { label: 'Start Job', newStatus: 'in_progress' },
    { label: 'Reschedule', newStatus: 'unscheduled' },
    { label: 'Cancel', newStatus: 'cancelled', destructive: true },
  ],
  in_progress: [
    { label: 'Complete Job', newStatus: 'completed' },
  ],
  completed: [
    { label: 'Verify', newStatus: 'verified' },
    { label: 'Reopen', newStatus: 'in_progress' },
  ],
  verified: [
    { label: 'Archive', newStatus: 'archived' },
  ],
  cancelled: [
    { label: 'Reopen', newStatus: 'unscheduled' },
  ],
};

export function QuickActionBar({ jobId, status, onStatusChange }: QuickActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<{ label: string; newStatus: string } | null>(null);

  const statusMut = useApiMutation<void, { status: string }>(
    'patch',
    `/v1/jobs/${jobId}/status`,
    [['jobs'], ['job', jobId]],
  );

  const actions = STATUS_ACTIONS[status] || [];

  const handleAction = async (newStatus: string, label: string) => {
    try {
      await statusMut.mutateAsync({ status: newStatus });
      toast.success(`Job ${label.toLowerCase()}`);
      onStatusChange();
    } catch {
      toast.error(`Failed to ${label.toLowerCase()}.`);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.destructive ? 'destructive' : 'default'}
            onClick={() => {
              if (action.destructive) {
                setConfirmAction(action);
              } else {
                handleAction(action.newStatus, action.label);
              }
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`${confirmAction?.label}?`}
        description={`Are you sure you want to ${confirmAction?.label.toLowerCase()} this job? This action cannot be easily undone.`}
        onConfirm={() => {
          if (confirmAction) handleAction(confirmAction.newStatus, confirmAction.label);
          setConfirmAction(null);
        }}
        variant="destructive"
      />
    </>
  );
}
