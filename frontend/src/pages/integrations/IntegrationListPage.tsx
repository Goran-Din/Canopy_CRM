import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';
import { Plug } from 'lucide-react';

interface Integration {
  id: string; provider: string; status: string; is_active: boolean;
  last_sync_at: string | null; last_error: string | null; updated_at: string;
}

const providerInfo: Record<string, { name: string; description: string }> = {
  xero: { name: 'Xero', description: 'Accounting & invoicing sync' },
  mautic: { name: 'Mautic', description: 'Marketing automation' },
  google_drive: { name: 'Google Drive', description: 'Document storage' },
  canopy_quotes: { name: 'Canopy Quotes', description: 'Quote management' },
  canopy_ops: { name: 'Canopy Ops', description: 'Operations assistant' },
  northchat: { name: 'NorthChat', description: 'Customer communication' },
};

export default function IntegrationListPage() {
  const { data: integrations, isLoading } = useApiGet<Integration[]>(['integrations'], '/v1/integrations');
  const connectMut = useApiMutation<unknown, { provider: string }>('post', (vars) => `/v1/integrations/${vars.provider}/connect`, [['integrations']]);
  const disconnectMut = useApiMutation<unknown, { provider: string }>('post', (vars) => `/v1/integrations/${vars.provider}/disconnect`, [['integrations']]);

  const handleConnect = (provider: string) => {
    connectMut.mutate({ provider, auth_code: 'placeholder' } as never, {
      onSuccess: () => toast.success(`${provider} connected`),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const handleDisconnect = (provider: string) => {
    disconnectMut.mutate({ provider }, {
      onSuccess: () => toast.success(`${provider} disconnected`),
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed'),
    });
  };

  const allProviders = Object.keys(providerInfo);

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect external services" />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allProviders.map((provider) => {
            const integration = (integrations ?? []).find((i) => i.provider === provider);
            const info = providerInfo[provider];
            const isConnected = integration?.is_active ?? false;

            return (
              <Card key={provider}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plug className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">{info.name}</CardTitle>
                    </div>
                    <StatusBadge status={isConnected ? 'active' : 'inactive'} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                  {integration?.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                    </p>
                  )}
                  {integration?.last_error && (
                    <p className="text-xs text-red-600 truncate">Error: {integration.last_error}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    {isConnected ? (
                      <Button variant="destructive" size="sm" onClick={() => handleDisconnect(provider)} disabled={disconnectMut.isPending}>
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect(provider)} disabled={connectMut.isPending}>
                        Connect
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
