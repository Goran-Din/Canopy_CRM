import { PageHeader } from '@/components/shared/PageHeader';

interface ReportHeaderProps {
  title: string;
  description?: string;
}

/**
 * Thin wrapper over PageHeader to give all report pages a single import site.
 * Future additions (last-updated stamp, breadcrumb) land here without touching
 * every page.
 */
export function ReportHeader({ title, description }: ReportHeaderProps) {
  return <PageHeader title={title} description={description} />;
}
