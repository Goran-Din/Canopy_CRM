import { ArrowLeft, Dog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useNavigate, Link } from 'react-router-dom';
import { QuickActionBar } from './components/QuickActionBar';
import type { JobDetail } from './JobCard';

interface JobCardHeaderProps {
  job: JobDetail;
  onStatusChange: () => void;
}

export function JobCardHeader({ job, onStatusChange }: JobCardHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3 border-b pb-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              Job #{job.job_number} — {job.title}
            </h1>
            <StatusBadge status={job.status} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground pl-10">
        <span>
          Customer:{' '}
          <Link to={`/customers/${job.customer_id}`} className="text-primary hover:underline">
            {job.customer_display_name}
          </Link>
        </span>
        <span>
          Property:{' '}
          <Link to={`/properties/${job.property_id}`} className="text-primary hover:underline">
            {job.property_name || job.property_address || 'View Property'}
          </Link>
        </span>
        <span>Division: {job.division}</span>
        <span>Crew: {job.assigned_crew_name || 'Unassigned'}</span>
        {job.scheduled_date && (
          <span>
            Scheduled: {new Date(job.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>

      {job.special_crew_instructions && (
        <div className="ml-10 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm font-medium text-amber-800">Special Instructions</p>
          <p className="text-sm text-amber-700 mt-1">{job.special_crew_instructions}</p>
        </div>
      )}

      {(job.dogs_on_property === 'yes' || job.dogs_on_property === 'sometimes') && (
        <div className="ml-10 flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
          <Dog className="h-4 w-4 text-orange-600" />
          <span className="text-sm text-orange-700">
            {job.dogs_on_property === 'yes' ? 'Dog on property' : 'Dog on property — sometimes loose in backyard'}
          </span>
        </div>
      )}

      <div className="pl-10">
        <QuickActionBar jobId={job.id} status={job.status} onStatusChange={onStatusChange} />
      </div>
    </div>
  );
}
