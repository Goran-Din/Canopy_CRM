import { Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { CrewPosition } from '../LiveCrewMapPage';

interface CrewMarkerProps {
  crew: CrewPosition;
  onClick: () => void;
}

export function CrewMarker({ crew, onClick }: CrewMarkerProps) {
  if (crew.lat == null || crew.lng == null) return null;

  const isOnSite = crew.status === 'on_site';
  const icon = L.divIcon({
    className: '',
    html: `<div style="background:${crew.color_hex || '#888'};width:36px;height:36px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;
      border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
      ${isOnSite ? 'animation:pulse 2s infinite' : ''}">
      ${crew.crew_name.charAt(0).toUpperCase()}
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  return (
    <Marker position={[crew.lat, crew.lng]} icon={icon} eventHandlers={{ click: onClick }}>
      <Tooltip>{crew.crew_name} — {crew.status.replace(/_/g, ' ')}</Tooltip>
      <Popup>
        <div className="text-sm space-y-1">
          <p className="font-bold">{crew.crew_name}</p>
          <p>{crew.status.replace(/_/g, ' ').toUpperCase()}</p>
          {crew.current_property_address && <p>📍 {crew.current_property_address}</p>}
          {crew.arrived_at && <p>Arrived: {new Date(crew.arrived_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>}
        </div>
      </Popup>
    </Marker>
  );
}
