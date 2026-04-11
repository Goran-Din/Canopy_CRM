import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { JobDetail } from '../JobCard';

interface OverviewTabProps {
  job: JobDetail;
}

export function OverviewTab({ job }: OverviewTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Property Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">
            {job.property_address || job.property_name || 'No address'}
          </p>
          {(job.property_city || job.property_state) && (
            <p className="text-muted-foreground">
              {[job.property_city, job.property_state, job.property_zip].filter(Boolean).join(', ')}
            </p>
          )}
          {job.property_category && (
            <p><span className="text-muted-foreground">Category:</span> {job.property_category}</p>
          )}
          {job.property_lot_size && (
            <p><span className="text-muted-foreground">Lot size:</span> {job.property_lot_size}</p>
          )}
          {job.last_visited && (
            <p>
              <span className="text-muted-foreground">Last visited:</span>{' '}
              {new Date(job.last_visited).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link to={`/properties/${job.property_id}`}>Open Property Card →</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
            Contract & Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {job.contract_tier && (
            <p><span className="text-muted-foreground">Tier:</span> {job.contract_tier}</p>
          )}
          {job.contract_price && (
            <p><span className="text-muted-foreground">Price:</span> ${job.contract_price}/month</p>
          )}
          {job.contract_season_start && job.contract_season_end && (
            <p>
              <span className="text-muted-foreground">Season:</span>{' '}
              {new Date(job.contract_season_start).toLocaleDateString('en-US', { month: 'short' })}–
              {new Date(job.contract_season_end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          )}
          {job.occurrence_number && job.total_occurrences && (
            <p>
              <span className="text-muted-foreground">Occurrences:</span>{' '}
              {job.occurrence_number} of {job.total_occurrences}
            </p>
          )}
          <div className="border-t pt-2 mt-2">
            <p>
              <span className="text-muted-foreground">Assigned crew:</span>{' '}
              {job.assigned_crew_name || 'Unassigned'}
            </p>
            {job.crew_leader_name && (
              <p><span className="text-muted-foreground">Crew leader:</span> {job.crew_leader_name}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
