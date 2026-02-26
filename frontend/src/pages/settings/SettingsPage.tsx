import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Grid3X3, Plug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useApiGet } from '@/hooks/useApi';

interface TenantInfo {
  name: string;
  slug: string;
  settings: { timezone?: string; currency?: string };
}

interface Division {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: { role: string; count: number }[];
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');

  const { data: stats } = useApiGet<UserStats>(['user-stats'], '/v1/users/stats');
  const { data: tenant } = useApiGet<TenantInfo>(['tenant-info'], '/v1/health');
  const { data: divisions } = useApiGet<Division[]>(['divisions'], '/v1/health');

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your organization" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="divisions">Divisions</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-green-600">{stats?.active ?? 0}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-muted-foreground">{stats?.inactive ?? 0}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </CardContent>
            </Card>
          </div>
          {stats?.byRole && stats.byRole.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Users by Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {stats.byRole.map((r) => (
                    <div key={r.role} className="flex items-center gap-2">
                      <span className="text-sm capitalize">{r.role.replace(/_/g, ' ')}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {r.count}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <Button onClick={() => navigate('/settings/users')}>
            <Users className="mr-2 h-4 w-4" />
            Manage Users
          </Button>
        </TabsContent>

        <TabsContent value="company" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company Information
              </CardTitle>
              <CardDescription>Your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Company Name</p>
                <p className="font-medium">{tenant?.name ?? 'Sunset Services'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Slug</p>
                <p>{tenant?.slug ?? 'sunset-services'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timezone</p>
                <p>{tenant?.settings?.timezone ?? 'America/Toronto'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currency</p>
                <p>{tenant?.settings?.currency ?? 'CAD'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divisions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                Divisions
              </CardTitle>
              <CardDescription>Service divisions in your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {(divisions ?? [
                  { id: '1', name: 'landscaping_maintenance', display_name: 'Landscaping Maintenance', is_active: true },
                  { id: '2', name: 'landscaping_projects', display_name: 'Landscaping Projects', is_active: true },
                  { id: '3', name: 'hardscape', display_name: 'Hardscape', is_active: true },
                  { id: '4', name: 'snow_removal', display_name: 'Snow Removal', is_active: true },
                ]).map((div) => (
                  <div
                    key={div.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{div.display_name}</p>
                      <p className="text-xs text-muted-foreground">{div.name}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        div.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {div.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Integrations
              </CardTitle>
              <CardDescription>Manage third-party integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate('/integrations')}>
                <Plug className="mr-2 h-4 w-4" />
                Go to Integrations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
