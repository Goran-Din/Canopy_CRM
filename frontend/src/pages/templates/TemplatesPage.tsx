import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/stores/authStore';
import { QuoteTemplateList } from './quotes/QuoteTemplateList';
import { ContractTemplateList } from './contracts/ContractTemplateList';
import { FieldTasksTab } from './FieldTasksTab';
import { EmailTemplateList } from './emails/EmailTemplateList';
import { AutomationList } from './automations/AutomationList';

export default function TemplatesPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab || 'quotes';
  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles.map((r) => r.role) ?? [];
  const isOwner = userRoles.includes('owner');

  return (
    <div className="space-y-4">
      <PageHeader title="Templates" />

      <Tabs
        value={activeTab}
        onValueChange={(t) => navigate(`/settings/templates/${t}`, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="field-tasks">Field Tasks</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          {isOwner && <TabsTrigger value="automations">Automations</TabsTrigger>}
        </TabsList>

        <TabsContent value="quotes"><QuoteTemplateList /></TabsContent>
        <TabsContent value="contracts"><ContractTemplateList /></TabsContent>
        <TabsContent value="field-tasks"><FieldTasksTab /></TabsContent>
        <TabsContent value="emails"><EmailTemplateList /></TabsContent>
        {isOwner && <TabsContent value="automations"><AutomationList /></TabsContent>}
      </Tabs>
    </div>
  );
}
