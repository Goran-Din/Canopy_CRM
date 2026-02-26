import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { useApiMutation, useApiList } from '@/hooks/useApi';
import { toast } from 'sonner';

const schema = z.object({
  user_id: z.string().min(1, 'User is required'),
  role_in_crew: z.enum(['leader', 'member']),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewId: string;
}

export function CrewMemberDialog({ open, onOpenChange, crewId }: Props) {
  const { data: usersResult } = useApiList<{ id: string; email: string; first_name: string; last_name: string }>(
    ['users', 'select'], '/v1/users', { limit: 100 }, { enabled: open },
  );

  const { handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { user_id: '', role_in_crew: 'member' },
  });

  useEffect(() => {
    if (!open) reset({ user_id: '', role_in_crew: 'member' });
  }, [open, reset]);

  const mutation = useApiMutation('post', `/v1/crews/${crewId}/members`, [['crew', crewId], ['crews']]);

  const onSubmit = (data: FormData) => {
    mutation.mutate(data as never, {
      onSuccess: () => { toast.success('Member added'); onOpenChange(false); },
      onError: (err) => { toast.error(err.response?.data?.message ?? 'Failed to add member'); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Crew Member</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="User" error={errors.user_id?.message} required>
            <Select value={watch('user_id')} onValueChange={(v) => setValue('user_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
              <SelectContent>
                {(usersResult?.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Role" error={errors.role_in_crew?.message}>
            <Select value={watch('role_in_crew')} onValueChange={(v) => setValue('role_in_crew', v as FormData['role_in_crew'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="leader">Leader</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Adding...' : 'Add Member'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
