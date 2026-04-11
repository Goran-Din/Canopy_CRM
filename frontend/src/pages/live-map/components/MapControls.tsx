import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Maximize2 } from 'lucide-react';

interface MapControlsProps {
  divisionFilter: string | null;
  onDivisionChange: (div: string | null) => void;
  showGeofences: boolean;
  onToggleGeofences: () => void;
  onFitAll: () => void;
}

export function MapControls({ divisionFilter, onDivisionChange, showGeofences, onToggleGeofences, onFitAll }: MapControlsProps) {
  return (
    <div className="absolute top-3 left-3 z-[1000] bg-white/95 border rounded-lg shadow-md p-3 space-y-3">
      <Select value={divisionFilter ?? 'all'} onValueChange={(v) => onDivisionChange(v === 'all' ? null : v)}>
        <SelectTrigger className="h-8 text-sm w-44">
          <SelectValue placeholder="All Divisions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Divisions</SelectItem>
          <SelectItem value="landscaping_maintenance">Landscaping</SelectItem>
          <SelectItem value="hardscape">Hardscape</SelectItem>
          <SelectItem value="snow_removal">Snow</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Switch checked={showGeofences} onCheckedChange={onToggleGeofences} id="geofence-toggle" />
        <Label htmlFor="geofence-toggle" className="text-xs">Geofences</Label>
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onFitAll}>
        <Maximize2 className="h-3.5 w-3.5 mr-1" />
        Show All
      </Button>
    </div>
  );
}
