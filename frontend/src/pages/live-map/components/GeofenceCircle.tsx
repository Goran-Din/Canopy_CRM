import { Circle, Tooltip, Popup } from 'react-leaflet';
import type { TodayProperty } from '../LiveCrewMapPage';

interface GeofenceCircleProps {
  property: TodayProperty;
  hasCrewOnSite: boolean;
}

export function GeofenceCircle({ property, hasCrewOnSite }: GeofenceCircleProps) {
  return (
    <Circle
      center={[property.lat, property.lng]}
      radius={property.geofence_radius_metres}
      pathOptions={{
        color: '#1ABC9C',
        fillColor: '#1ABC9C',
        fillOpacity: hasCrewOnSite ? 0.5 : 0.2,
        weight: 2,
      }}
    >
      <Tooltip>{property.address}{property.crew_name ? ` — ${property.crew_name}` : ''}</Tooltip>
      <Popup>
        <div className="text-sm space-y-1">
          <p className="font-bold">{property.address}</p>
          <p>Job #{property.job_number}</p>
          {property.crew_name && <p>Crew: {property.crew_name}</p>}
        </div>
      </Popup>
    </Circle>
  );
}
