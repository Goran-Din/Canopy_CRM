import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Key, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { PageHeader } from '@/components/shared/PageHeader';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface UserRole {
  role: string;
  division_id: string | null;
  division_name: string | null;
}

interface UserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  roles: UserRole[];
  created_at: string;
  updated_at: string;
}

const ROLE_OPTIONS = ['owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member', 'client'];
const DIVISION_OPTIONS = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'];

const roleColors: Record<string, string> = {
  owner: 'bg-red-100 text-red-800 border-red-200',
  div_mgr: 'bg-purple-100 text-purple-800 border-purple-200',
  coordinator: 'bg-blue-100 text-blue-800 border-blue-200',
  crew_leader: 'bg-amber-100 text-amber-800 border-amber-200',
  crew_member: 'bg-green-100 text-green-800 border-green-200',
  client: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [showAddDivision, setShowAddDivision] = useState(false);
  const [newDivision, setNewDivision] = useState('');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const invalidateKeys = [['user', id], ['users'], ['user-stats']];
  const { data: user, isLoading } = useApiGet<UserDetail>(
    ['user', id],
    `/v1/users/${id}`,
    undefined,
    { enabled: !!id },
  );

  const updateMut = useApiMutation('put', `/v1/users/${id}`, invalidateKeys);
  const passwordMut = useApiMutation('put', `/v1/users/${id}/password`, invalidateKeys);
  const deactivateMut = useApiMutation('post', `/v1/users/${id}/deactivate`, invalidateKeys);
  const activateMut = useApiMutation('post', `/v1/users/${id}/activate`, invalidateKeys);
  const addRoleMut = useApiMutation('post', `/v1/users/${id}/roles`, invalidateKeys);
  const removeRoleMut = useApiMutation<unknown, string>('delete', (role: string) => `/v1/users/${id}/roles/${role}`, invalidateKeys);
  const addDivMut = useApiMutation('post', `/v1/users/${id}/divisions`, invalidateKeys);
  const removeDivMut = useApiMutation<unknown, string>('delete', (div: string) => `/v1/users/${id}/divisions/${div}`, invalidateKeys);

  const startEdit = () => {
    if (!user) return;
    setEditData({ first_name: user.first_name, last_name: user.last_name, email: user.email, phone: user.phone ?? '' });
    setEditing(true);
  };

  const saveEdit = () => {
    updateMut.mutate(editData as never, {
      onSuccess: () => { toast.success('User updated'); setEditing(false); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const changePassword = () => {
    if (newPassword.length < 8) { toast.error('Min 8 characters'); return; }
    passwordMut.mutate({ password: newPassword } as never, {
      onSuccess: () => { toast.success('Password changed'); setShowPassword(false); setNewPassword(''); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const toggleActive = () => {
    if (!user) return;
    const mut = user.is_active ? deactivateMut : activateMut;
    mut.mutate({} as never, {
      onSuccess: () => toast.success(user.is_active ? 'User deactivated' : 'User activated'),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const addRole = () => {
    if (!newRole) return;
    addRoleMut.mutate({ role: newRole } as never, {
      onSuccess: () => { toast.success('Role assigned'); setShowAddRole(false); setNewRole(''); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const removeRole = (role: string) => {
    removeRoleMut.mutate(role, {
      onSuccess: () => toast.success('Role removed'),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const addDivision = () => {
    if (!newDivision) return;
    addDivMut.mutate({ division: newDivision } as never, {
      onSuccess: () => { toast.success('Division assigned'); setShowAddDivision(false); setNewDivision(''); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const removeDivision = (div: string) => {
    removeDivMut.mutate(div, {
      onSuccess: () => toast.success('Division removed'),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!user) return <div className="py-12 text-center"><p className="text-muted-foreground">User not found</p></div>;

  const uniqueRoles = [...new Set(user.roles.map((r) => r.role))];
  const uniqueDivisions = [...new Set(user.roles.filter((r) => r.division_name).map((r) => r.division_name!))];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={`${user.first_name} ${user.last_name}`}
          description={user.email}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPassword(true)}>
                <Key className="mr-1 h-4 w-4" />
                Password
              </Button>
              <Button
                variant={user.is_active ? 'destructive' : 'default'}
                size="sm"
                onClick={toggleActive}
                disabled={deactivateMut.isPending || activateMut.isPending}
              >
                {user.is_active ? <><UserX className="mr-1 h-4 w-4" />Deactivate</> : <><UserCheck className="mr-1 h-4 w-4" />Activate</>}
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">User Details</CardTitle>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-3">
                <FormField label="First Name">
                  <Input value={editData.first_name} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} />
                </FormField>
                <FormField label="Last Name">
                  <Input value={editData.last_name} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} />
                </FormField>
                <FormField label="Email">
                  <Input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                </FormField>
                <FormField label="Phone">
                  <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
                </FormField>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div><p className="text-xs text-muted-foreground">Name</p><p>{user.first_name} {user.last_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p>{user.email}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p>{user.phone ?? '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Last Login</p><p>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</p></div>
                <div><p className="text-xs text-muted-foreground">Created</p><p>{new Date(user.created_at).toLocaleDateString()}</p></div>
                <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Roles & Divisions */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Roles</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowAddRole(true)}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Role
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {uniqueRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uniqueRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className={`text-sm ${roleColors[role] ?? ''} cursor-default`}
                    >
                      {role.replace(/_/g, ' ')}
                      <button
                        className="ml-1.5 rounded-full hover:bg-black/10 p-0.5"
                        onClick={() => removeRole(role)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Divisions</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowAddDivision(true)}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Division
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {uniqueDivisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No division access assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uniqueDivisions.map((div) => (
                    <Badge key={div} variant="outline" className="text-sm bg-blue-50 text-blue-800 border-blue-200 cursor-default">
                      {div.replace(/_/g, ' ')}
                      <button
                        className="ml-1.5 rounded-full hover:bg-black/10 p-0.5"
                        onClick={() => removeDivision(div)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showPassword} onOpenChange={setShowPassword}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <FormField label="New Password">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
            </FormField>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPassword(false)}>Cancel</Button>
              <Button onClick={changePassword} disabled={passwordMut.isPending}>{passwordMut.isPending ? 'Saving...' : 'Change Password'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Role</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.filter((r) => !uniqueRoles.includes(r)).map((r) => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddRole(false)}>Cancel</Button>
              <Button onClick={addRole} disabled={addRoleMut.isPending || !newRole}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Division Dialog */}
      <Dialog open={showAddDivision} onOpenChange={setShowAddDivision}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Division</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={newDivision} onValueChange={setNewDivision}>
              <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
              <SelectContent>
                {DIVISION_OPTIONS.filter((d) => !uniqueDivisions.includes(d)).map((d) => (
                  <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddDivision(false)}>Cancel</Button>
              <Button onClick={addDivision} disabled={addDivMut.isPending || !newDivision}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
