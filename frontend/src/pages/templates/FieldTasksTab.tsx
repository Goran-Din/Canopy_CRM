import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useApiGet } from '@/hooks/useApi';

interface SopTemplate {
  id: string;
  name: string;
  task_count: number;
  usage_count: number;
}

export function FieldTasksTab() {
  const navigate = useNavigate();
  const { data: sops = [] } = useApiGet<SopTemplate[]>(
    ['sop-templates-recent'],
    '/v1/sop-templates',
    { limit: '10', sort: 'usage_count' },
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Field Task Checklists</h3>
          <p className="text-sm text-muted-foreground">Managed in the SOP Library. Click to open full manager.</p>
        </div>
        <Button onClick={() => navigate('/sops')}>
          Open SOP Manager <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {sops.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Checklists</h4>
          <div className="space-y-1">
            {sops.map((sop) => (
              <button
                key={sop.id}
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-sm text-left"
                onClick={() => navigate(`/sops/templates/${sop.id}`)}
              >
                <span className="font-medium">{sop.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sop.task_count} tasks &middot; Used {sop.usage_count} times
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
