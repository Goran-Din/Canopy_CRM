import { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiGet } from '@/hooks/useApi';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CrewStatusPanel } from './components/CrewStatusPanel';

// Fix for missing default marker icons in Vite builds
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface CrewPosition {
  crew_id: string;
  crew_name: string;
  color_hex: string;
  status: 'on_site' | 'in_transit' | 'not_clocked_in' | 'clocked_out' | 'no_signal';
  lat: number | null;
  lng: number | null;
  current_property_address: string | null;
  current_job_id: string | null;
  current_job_number: string | null;
  arrived_at: string | null;
  last_gps_event_at: string | null;
  jobs_today: {
    job_id: string;
    job_number: string;
    property_address: string;
    status: string;
    scheduled_time: string | null;
    duration_minutes: number | null;
  }[];
}

export interface TodayProperty {
  property_id: string;
  address: string;
  lat: number;
  lng: number;
  geofence_radius_metres: number;
  job_id: string;
  job_number: string;
  crew_name: string | null;
  scheduled_time: string | null;
}

// Default center: Aurora, Illinois
const DEFAULT_CENTER: [number, number] = [41.7606, -88.3201];
const DEFAULT_ZOOM = 12;

export default function LiveCrewMapPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const { data: crewData, refetch: refetchCrews } = useApiGet<{ positions: CrewPosition[] }>(
    ['live-crew-positions'],
    '/v1/gps-events/live-crew-positions',
  );

  const { data: propertyData, refetch: refetchProperties } = useApiGet<{ properties: TodayProperty[] }>(
    ['today-properties'],
    '/v1/geofence/today-office-properties',
  );

  const crews = crewData?.positions || [];
  void propertyData; // will be used when geofence circles are wired up
  const activeCrews = crews.filter((c) => c.status !== 'clocked_out' && c.status !== 'not_clocked_in');

  const handleRefresh = useCallback(() => {
    refetchCrews();
    refetchProperties();
    setLastUpdated(new Date());
  }, [refetchCrews, refetchProperties]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(handleRefresh, 60000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Seconds-ago counter
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const handleCrewClick = (_crewId: string) => {
    // Will center map on crew — handled via ref in future
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Live Crew Map
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeCrews.length} crews active &middot; Last updated {secondsAgo}s ago
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{dateStr} &middot; {timeStr}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Map */}
        <div className="flex-1 min-w-0 rounded-lg overflow-hidden border" style={{ minHeight: '400px' }}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
        </div>

        {/* Crew Status Panel */}
        <div className="hidden lg:block w-80 shrink-0 overflow-y-auto border rounded-lg">
          <CrewStatusPanel crews={crews} onCrewClick={handleCrewClick} />
        </div>
      </div>
    </div>
  );
}
