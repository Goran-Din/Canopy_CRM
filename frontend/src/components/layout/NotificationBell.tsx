import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApiGet } from '@/hooks/useApi';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: string;
  created_at: string;
}

interface UnreadCount {
  count: number;
}

interface NotificationList {
  data: Notification[];
  pagination: { total: number };
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: unread } = useApiGet<UnreadCount>(
    ['notification-unread-count'],
    '/v1/notifications/unread-count',
    undefined,
    { refetchInterval: 30000 },
  );

  const { data: recent } = useApiGet<NotificationList>(
    ['notifications-recent'],
    '/v1/notifications',
    { limit: 5 },
  );

  const count = unread?.count ?? 0;
  const notifications = recent?.data ?? [];

  const priorityColor: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    normal: 'bg-primary',
    low: 'bg-muted-foreground',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {count > 0 && <span className="text-xs text-muted-foreground">{count} unread</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-1 py-3 cursor-pointer"
              onClick={() => navigate('/notifications')}
            >
              <div className="flex items-center gap-2 w-full">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-transparent' : priorityColor[n.priority] || 'bg-primary'}`} />
                <span className={`text-sm flex-1 truncate ${n.is_read ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate w-full pl-4">{n.message}</p>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-sm text-primary cursor-pointer" onClick={() => navigate('/notifications')}>
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
