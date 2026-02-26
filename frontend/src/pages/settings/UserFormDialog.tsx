import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/shared/FormField';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'div_mgr', label: 'Division Manager' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'crew_leader', label: 'Crew Leader' },
  { value: 'crew_member', label: 'Crew Member' },
  { value: 'client', label: 'Client' },
];

const DIVISIONS = [
  { value: 'landscaping_maintenance', label: 'Landscaping Maintenance' },
  { value: 'landscaping_projects', label: 'Landscaping Projects' },
  { value: 'hardscape', label: 'Hardscape' },
  { value: 'snow_removal', label: 'Snow Removal' },
];

const createSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
  phone: z.string().optional(),
  roles: z.array(z.string()).optional(),
  divisions: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof createSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormDialog({ open, onOpenChange }: UserFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { roles: [], divisions: [] },
  });

  const selectedRoles = watch('roles') ?? [];
  const selectedDivisions = watch('divisions') ?? [];

  const createMut = useApiMutation('post', '/v1/users', [['users'], ['user-stats']]);

  const onSubmit = (data: FormData) => {
    createMut.mutate(data as never, {
      onSuccess: () => {
        toast.success('User created');
        reset();
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to create user'),
    });
  };

  const toggleRole = (role: string) => {
    const current = selectedRoles;
    if (current.includes(role)) {
      setValue('roles', current.filter((r) => r !== role));
    } else {
      setValue('roles', [...current, role]);
    }
  };

  const toggleDivision = (div: string) => {
    const current = selectedDivisions;
    if (current.includes(div)) {
      setValue('divisions', current.filter((d) => d !== div));
    } else {
      setValue('divisions', [...current, div]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name" error={errors.first_name?.message}>
              <Input {...register('first_name')} />
            </FormField>
            <FormField label="Last Name" error={errors.last_name?.message}>
              <Input {...register('last_name')} />
            </FormField>
          </div>

          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </FormField>

          <FormField label="Password" error={errors.password?.message}>
            <Input type="password" {...register('password')} placeholder="Min 8 characters" />
          </FormField>

          <FormField label="Phone">
            <Input {...register('phone')} placeholder="Optional" />
          </FormField>

          <div>
            <Label className="text-sm font-medium">Roles</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ROLES.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <span className="text-sm">{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Divisions</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DIVISIONS.map((div) => (
                <label
                  key={div.value}
                  className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedDivisions.includes(div.value)}
                    onCheckedChange={() => toggleDivision(div.value)}
                  />
                  <span className="text-sm">{div.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
