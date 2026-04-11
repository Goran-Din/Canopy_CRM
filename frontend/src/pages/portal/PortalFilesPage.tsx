import { useAuthStore } from '@/stores/authStore';
import { PortalFileView } from '@/components/files/PortalFileView';

export default function PortalFilesPage() {
  const user = useAuthStore((s) => s.user);

  if (!user?.customer_id) {
    return <p className="text-muted-foreground">Unable to load files.</p>;
  }

  return <PortalFileView customerId={user.customer_id} />;
}
