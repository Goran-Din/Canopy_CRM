import type { CrewPosition } from '../LiveCrewMapPage';
import { CrewRowDetail } from './CrewRowDetail';

interface CrewStatusPanelProps {
  crews: CrewPosition[];
  onCrewClick: (crewId: string) => void;
}

const STATUS_ORDER: Record<string, number> = {
  on_site: 0,
  in_transit: 1,
  no_signal: 2,
  not_clocked_in: 3,
  clocked_out: 4,
};

export function CrewStatusPanel({ crews, onCrewClick }: CrewStatusPanelProps) {
  const sorted = [...crews].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
  );

  return (
    <div>
      <div className="px-3 py-2 border-b">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Crew Status
        </h3>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No crew data available.</p>
      ) : (
        sorted.map((crew) => (
          <CrewRowDetail
            key={crew.crew_id}
            crew={crew}
            onClick={() => onCrewClick(crew.crew_id)}
          />
        ))
      )}
    </div>
  );
}
