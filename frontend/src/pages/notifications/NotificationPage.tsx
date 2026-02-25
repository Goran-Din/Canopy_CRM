import { useState } from 'react';
import { Bell, CheckCheck, Mail, MailOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useApiGet, useApiMutation } from '@/hooks/useApi';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  priority: string;
  delivery_method: string;
  created_at: string;
}

interface NotificationList {
  data: Notification[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const priorityStyles: Record<string, string> = {
  urgent: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-500',
  normal: 'border-l-4 border-l-primary',
  low: 'border-l-4 border-l-muted',
};

const typeLabels: Record<string, string> = {
  job_assigned: 'Job Assigned',
  job_completed: 'Job Completed',
  invoice_overdue: 'Invoice Overdue',
  payment_received: 'Payment Received',
  dispute_opened: 'Dispute Opened',
  contract_expiring: 'Contract Expiring',
  snow_run_started: 'Snow Run Started',
  equipment_maintenance_due: 'Maintenance Due',
  low_stock_alert: 'Low Stock',
  prospect_follow_up: 'Follow Up',
  schedule_change: 'Schedule Change',
  system_alert: 'System Alert',
};

export default function NotificationPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  const params: Record<string, unknown> = { page, limit: 25 };
  if (filter === 'unread') params.unread_only = true;

  const { data, isLoading } = useApiGet<NotificationList>(
    ['notifications', page, filter],
    '/v1/notifications',
    params,
  );

  const markReadMut = useApiMutation<unknown, { id: string }>(
    'patch',
    (vars) => `/v1/notifications/${vars.id}/read`,
    [['notifications'], ['notification-unread-count'], ['notifications-recent']],
  );

  const markAllMut = useApiMutation(
    'post',
    '/v1/notifications/mark-all-read',
    [['notifications'], ['notification-unread-count'], ['notifications-recent']],
  );

  const notifications = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated on activity"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllMut.mutate({} as never)}
            disabled={markAllMut.isPending}
          >
            <CheckCheck className="mr-1 h-4 w-4" />
            Mark All Read
          </Button>
        }
      />

      <div className="flex gap-3">
        <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`${priorityStyles[n.priority] || ''} ${!n.is_read ? 'bg-primary/5' : ''}`}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="mt-0.5">
                  {n.is_read ? (
                    <MailOpen className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Mail className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">{typeLabels[n.type] || n.type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markReadMut.mutate({ id: n.id })}
                    disabled={markReadMut.isPending}
                  >
                    Mark Read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{pagination.total} notifications</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
