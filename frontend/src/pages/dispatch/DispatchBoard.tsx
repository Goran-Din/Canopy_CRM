import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Search,
  PanelRightClose,
  PanelRightOpen,
  Clock,
  MapPin,
  AlertTriangle,
  ArrowUpRight,
  X,
  Users,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/api/client';
import { useApiMutation } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface BoardCrew {
  id: string;
  crew_name: string;
  division: string;
  status: string;
  color_code: string | null;
  crew_leader_first_name: string | null;
  crew_leader_last_name: string | null;
  member_count: string;
}

interface BoardJob {
  id: string;
  title: string;
  customer_name: string | null;
  property_address: string | null;
  job_type: string;
  status: string;
  priority: string;
  division: string;
  scheduled_date: string;
  scheduled_start_time: string | null;
  estimated_duration_minutes: number | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  assigned_crew_id: string;
}

interface QueueJob {
  id: string;
  title: string;
  customer_name: string | null;
  property_address: string | null;
  job_type: string;
  status: string;
  priority: string;
  division: string;
  scheduled_date: string | null;
  estimated_duration_minutes: number | null;
  contract_id: string | null;
}

interface BoardData {
  crews: BoardCrew[];
  jobs: BoardJob[];
}

interface QueueData {
  unassigned: QueueJob[];
  work_orders: QueueJob[];
  recurring_pending: QueueJob[];
  overdue: QueueJob[];
}

// ============================================
// Constants
// ============================================

const DIVISION_COLORS: Record<string, string> = {
  landscaping_maintenance: '#22C55E',
  landscaping_projects: '#14B8A6',
  hardscape: '#F97316',
  snow_removal: '#3B82F6',
};

const DIVISION_LABELS: Record<string, string> = {
  landscaping_maintenance: 'Maintenance',
  landscaping_projects: 'Landscape Projects',
  hardscape: 'Hardscape',
  snow_removal: 'Snow Removal',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#22C55E',
  cancelled: '#6B7280',
  skipped: '#EF4444',
};

const PRIORITY_ICONS: Record<string, string> = {
  urgent: '!!',
  high: '!',
  normal: '',
  low: '',
};

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 20; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 20) TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
}

// ============================================
// API Hooks
// ============================================

function useBoardData(startDate: string, endDate: string, division?: string) {
  return useQuery<BoardData>({
    queryKey: ['dispatch', 'board', startDate, endDate, division],
    queryFn: async () => {
      const params: Record<string, string> = { start_date: startDate, end_date: endDate };
      if (division) params.division = division;
      const { data } = await apiClient.get('/v1/dispatch/board', { params });
      return data.data;
    },
    refetchInterval: 30000,
  });
}

function useQueueData() {
  return useQuery<QueueData>({
    queryKey: ['dispatch', 'queue'],
    queryFn: async () => {
      const { data } = await apiClient.get('/v1/dispatch/queue');
      return data.data;
    },
    refetchInterval: 30000,
  });
}

// ============================================
// Droppable Cell
// ============================================

function DroppableCell({
  id,
  data,
  children,
  className,
}: {
  id: string;
  data?: { crewId: string; date: string; time: string };
  children?: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[72px] transition-colors',
        isOver && 'bg-primary/10',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// Draggable Job Block (Calendar)
// ============================================

function DraggableJobBlock({
  job,
  onClick,
}: {
  job: BoardJob;
  onClick: (job: BoardJob) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `board-${job.id}`,
    data: { type: 'board', job },
  });

  const duration = job.estimated_duration_minutes || 60;
  const statusColor = STATUS_COLORS[job.status] || '#6B7280';
  const divisionColor = DIVISION_COLORS[job.division] || '#6B7280';

  const mergedStyle = {
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    backgroundColor: statusColor,
    borderLeft: `3px solid ${divisionColor}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick(job);
      }}
      className={cn(
        'relative mx-0.5 my-1 cursor-grab rounded px-2 py-1.5 text-xs text-white shadow-sm select-none',
        isDragging && 'z-50 opacity-70',
      )}
    >
      <div className="flex items-center gap-1 font-medium truncate">
        {PRIORITY_ICONS[job.priority] && (
          <span className="text-yellow-200 font-bold">{PRIORITY_ICONS[job.priority]}</span>
        )}
        <span className="truncate">{job.customer_name || job.title}</span>
      </div>
      <div className="truncate opacity-80">{job.property_address}</div>
      <div className="flex items-center gap-1 opacity-80">
        <Clock className="h-3 w-3" />
        {job.scheduled_start_time?.slice(0, 5) || '--:--'}
        <span className="mx-0.5">·</span>
        {duration}min
      </div>
    </div>
  );
}

// ============================================
// Draggable Queue Card
// ============================================

function DraggableQueueCard({
  job,
  isOverdue,
}: {
  job: QueueJob;
  isOverdue?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `queue-${job.id}`,
    data: { type: 'queue', job },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const divisionColor = DIVISION_COLORS[job.division] || '#6B7280';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'mb-2 cursor-grab rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md select-none',
        isDragging && 'z-50 opacity-70 shadow-lg',
        isOverdue && 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: divisionColor }}
            />
            <span className="text-sm font-medium truncate">{job.customer_name || job.title}</span>
          </div>
          {job.property_address && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{job.property_address}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {job.priority === 'urgent' || job.priority === 'high' ? (
            <Badge variant={job.priority === 'urgent' ? 'destructive' : 'default'} className="text-[10px] px-1.5">
              {job.priority}
            </Badge>
          ) : null}
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5">
              <AlertTriangle className="mr-0.5 h-3 w-3" />
              overdue
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="capitalize">{job.job_type.replace('_', ' ')}</span>
        {job.estimated_duration_minutes && (
          <span className="flex items-center gap-0.5">
            <Timer className="h-3 w-3" />
            {job.estimated_duration_minutes}min
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Drag Overlay Card
// ============================================

function DragOverlayCard({ job }: { job: BoardJob | QueueJob }) {
  const divisionColor = DIVISION_COLORS[job.division] || '#6B7280';
  return (
    <div
      className="w-48 rounded-md border bg-card p-2 shadow-lg"
      style={{ borderLeft: `3px solid ${divisionColor}` }}
    >
      <div className="text-sm font-medium truncate">{job.customer_name || job.title}</div>
      {job.property_address && (
        <div className="text-xs text-muted-foreground truncate">{job.property_address}</div>
      )}
    </div>
  );
}

// ============================================
// Job Popover
// ============================================

function JobPopover({
  job,
  open,
  onOpenChange,
  onUnassign,
  children,
}: {
  job: BoardJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnassign: (jobId: string) => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const divisionColor = DIVISION_COLORS[job.division] || '#6B7280';
  const statusColor = STATUS_COLORS[job.status] || '#6B7280';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">{job.title}</h4>
              <p className="text-sm text-muted-foreground">{job.customer_name}</p>
            </div>
            <Badge
              className="text-[10px]"
              style={{ backgroundColor: statusColor, color: '#fff' }}
            >
              {job.status.replace('_', ' ')}
            </Badge>
          </div>

          {job.property_address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{job.property_address}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {job.scheduled_date} {job.scheduled_start_time?.slice(0, 5) || '--:--'}
            </span>
            {job.estimated_duration_minutes && (
              <span className="text-muted-foreground">({job.estimated_duration_minutes}min)</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: divisionColor }}
            />
            <span className="capitalize">{DIVISION_LABELS[job.division] || job.division}</span>
          </div>

          {job.priority !== 'normal' && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{job.priority} priority</span>
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <ArrowUpRight className="mr-1 h-3 w-3" />
              View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={() => {
                onUnassign(job.id);
                onOpenChange(false);
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Unassign
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// Current Time Indicator
// ============================================

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < 6 || hours >= 20) return null;

  const totalMinutes = (hours - 6) * 60 + minutes;
  const slotWidth = 80; // px per 30-min slot
  const leftPx = (totalMinutes / 30) * slotWidth;

  return (
    <div
      ref={ref}
      className="absolute top-0 bottom-0 z-30 w-[2px] bg-red-500 pointer-events-none"
      style={{ left: `${leftPx}px` }}
    >
      <div className="absolute -top-1.5 -left-[5px] h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-500/30 animate-pulse" />
    </div>
  );
}

// ============================================
// Main Dispatch Board
// ============================================

export default function DispatchBoard() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [division, setDivision] = useState<string>('all');
  const [queueTab, setQueueTab] = useState('all');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueOpen, setQueueOpen] = useState(true);
  const [selectedJob, setSelectedJob] = useState<BoardJob | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<(BoardJob | QueueJob) | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Date range calculation
  const dateRange = useMemo(() => {
    if (viewMode === 'day') {
      const d = format(currentDate, 'yyyy-MM-dd');
      return { start: d, end: d };
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };
  }, [currentDate, viewMode]);

  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate, viewMode]);

  const divisionParam = division === 'all' ? undefined : division;

  const {
    data: boardData,
    isLoading: boardLoading,
  } = useBoardData(dateRange.start, dateRange.end, divisionParam);

  const {
    data: queueData,
    isLoading: queueLoading,
  } = useQueueData();

  // Mutations
  const assignMutation = useApiMutation<unknown, {
    job_id: string;
    crew_id: string;
    scheduled_date: string;
    scheduled_start_time: string;
  }>('patch', '/v1/dispatch/assign', [['dispatch']]);

  const rescheduleMutation = useApiMutation<unknown, {
    job_id: string;
    crew_id?: string;
    scheduled_date?: string;
    scheduled_start_time?: string;
  }>('patch', '/v1/dispatch/reschedule', [['dispatch']]);

  const unassignMutation = useApiMutation<unknown, { job_id: string }>(
    'patch',
    '/v1/dispatch/unassign',
    [['dispatch']],
  );

  const crews = boardData?.crews ?? [];
  const jobs = boardData?.jobs ?? [];

  // Queue filtering
  const allQueueJobs = useMemo(() => {
    if (!queueData) return [];
    const map: Record<string, QueueJob[]> = {
      all: [
        ...queueData.unassigned,
        ...queueData.work_orders,
        ...queueData.recurring_pending,
        ...queueData.overdue,
      ],
      unassigned: queueData.unassigned,
      work_orders: queueData.work_orders,
      recurring: queueData.recurring_pending,
      overdue: queueData.overdue,
    };
    // Deduplicate 'all' by id
    const seen = new Set<string>();
    const dedupAll = (map.all || []).filter((j) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });
    if (queueTab === 'all') return dedupAll;
    return map[queueTab] || [];
  }, [queueData, queueTab]);

  const filteredQueue = useMemo(() => {
    if (!queueSearch) return allQueueJobs;
    const q = queueSearch.toLowerCase();
    return allQueueJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.customer_name?.toLowerCase().includes(q) ||
        j.property_address?.toLowerCase().includes(q),
    );
  }, [allQueueJobs, queueSearch]);

  const overdueIds = useMemo(() => {
    if (!queueData) return new Set<string>();
    return new Set(queueData.overdue.map((j) => j.id));
  }, [queueData]);

  // Get jobs for a specific crew and date
  const getJobsForCell = useCallback(
    (crewId: string, date?: string) => {
      return jobs.filter((j) => {
        if (j.assigned_crew_id !== crewId) return false;
        if (date && j.scheduled_date !== date) return false;
        return true;
      });
    },
    [jobs],
  );

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const data = active.data.current;
    if (data?.job) {
      setActiveItem(data.job);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    if (!overId.startsWith('cell-')) return;

    const cellData = over.data?.current;
    if (!cellData?.crewId || !cellData?.date) return;

    const crewId: string = cellData.crewId;
    const date: string = cellData.date;
    const time: string = cellData.time || '08:00';

    const jobData = activeData?.job;
    if (!jobData) return;

    const jobId = jobData.id;

    try {
      if (activeData?.type === 'queue') {
        // Queue -> Board: Assign
        await assignMutation.mutateAsync({
          job_id: jobId,
          crew_id: crewId,
          scheduled_date: date,
          scheduled_start_time: time,
        });
        toast.success('Job assigned successfully');
      } else if (activeData?.type === 'board') {
        // Board -> Board: Reschedule
        await rescheduleMutation.mutateAsync({
          job_id: jobId,
          crew_id: crewId,
          scheduled_date: date,
          scheduled_start_time: time,
        });
        toast.success('Job rescheduled successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['dispatch'] });
    } catch {
      toast.error('Failed to update job. Please try again.');
    }
  }

  const handleUnassign = useCallback(
    async (jobId: string) => {
      try {
        await unassignMutation.mutateAsync({ job_id: jobId });
        toast.success('Job unassigned');
        queryClient.invalidateQueries({ queryKey: ['dispatch'] });
      } catch {
        toast.error('Failed to unassign job');
      }
    },
    [unassignMutation, queryClient],
  );

  // Navigation
  function navigateDate(dir: 'prev' | 'next') {
    const delta = viewMode === 'day' ? 1 : 7;
    setCurrentDate((d) => (dir === 'next' ? addDays(d, delta) : subDays(d, delta)));
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Dispatch Board</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Division Filter */}
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All Divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                <SelectItem value="landscaping_maintenance">Maintenance</SelectItem>
                <SelectItem value="landscaping_projects">Landscape Projects</SelectItem>
                <SelectItem value="hardscape">Hardscape</SelectItem>
                <SelectItem value="snow_removal">Snow Removal</SelectItem>
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6" />

            {/* View Toggle */}
            <div className="flex items-center rounded-md border">
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-r-none"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-l-none"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Date Navigation */}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {viewMode === 'day'
                ? format(currentDate, 'EEE, MMM d, yyyy')
                : `${format(parseISO(dateRange.start), 'MMM d')} - ${format(parseISO(dateRange.end), 'MMM d, yyyy')}`}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            {/* Queue Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setQueueOpen(!queueOpen)}
            >
              {queueOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT + CENTER: Crew Roster + Calendar Grid */}
          <div className="flex flex-1 overflow-hidden">
            {/* Crew column header */}
            <div className="flex flex-col flex-shrink-0 w-48 border-r bg-muted/30">
              <div className="h-10 border-b flex items-center px-3 text-xs font-semibold uppercase text-muted-foreground">
                Crews ({crews.length})
              </div>
              <ScrollArea className="flex-1">
                {boardLoading ? (
                  <div className="p-3 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : crews.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">No active crews</div>
                ) : (
                  crews.map((crew) => (
                    <div
                      key={crew.id}
                      className="flex items-center gap-2 border-b px-3 py-3 min-h-[72px]"
                    >
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: crew.color_code || DIVISION_COLORS[crew.division] || '#6B7280' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{crew.crew_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {crew.crew_leader_first_name && (
                            <span className="truncate">
                              {crew.crew_leader_first_name} {crew.crew_leader_last_name?.[0]}.
                            </span>
                          )}
                          <span className="flex items-center gap-0.5 flex-shrink-0">
                            <Users className="h-3 w-3" />
                            {crew.member_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto relative">
              {viewMode === 'day' ? (
                /* DAY VIEW */
                <div className="min-w-[2400px]">
                  {/* Time header */}
                  <div className="sticky top-0 z-20 flex bg-background border-b">
                    {TIME_SLOTS.map((slot) => (
                      <div
                        key={slot}
                        className="w-20 flex-shrink-0 border-r px-1 py-2 text-center text-xs text-muted-foreground"
                      >
                        {slot}
                      </div>
                    ))}
                  </div>

                  {/* Crew rows */}
                  <div className="relative">
                    {isToday(currentDate) && <CurrentTimeLine />}
                    {crews.map((crew) => {
                      const crewJobs = getJobsForCell(crew.id);
                      return (
                        <div key={crew.id} className="flex min-h-[72px]">
                          {TIME_SLOTS.map((slot) => {
                            const cellDate = format(currentDate, 'yyyy-MM-dd');
                            const cellId = `cell-${crew.id}-${cellDate}-${slot}`;
                            const jobsAtSlot = crewJobs.filter(
                              (j) => j.scheduled_start_time?.slice(0, 5) === slot,
                            );

                            return (
                              <DroppableCell
                                key={cellId}
                                id={cellId}
                                data={{ crewId: crew.id, date: cellDate, time: slot }}
                                className="w-20 border-b border-r"
                              >
                                <div className="w-20 min-h-[72px] relative">
                                  {jobsAtSlot.map((job) => (
                                    <JobPopover
                                      key={job.id}
                                      job={job}
                                      open={popoverOpen && selectedJob?.id === job.id}
                                      onOpenChange={(open) => {
                                        setPopoverOpen(open);
                                        if (!open) setSelectedJob(null);
                                      }}
                                      onUnassign={handleUnassign}
                                    >
                                      <div>
                                        <DraggableJobBlock
                                          job={job}
                                          onClick={(j) => {
                                            setSelectedJob(j);
                                            setPopoverOpen(true);
                                          }}
                                        />
                                      </div>
                                    </JobPopover>
                                  ))}
                                </div>
                              </DroppableCell>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* WEEK VIEW */
                <div className="min-w-[700px]">
                  {/* Day headers */}
                  <div className="sticky top-0 z-20 flex bg-background border-b">
                    {weekDays.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'flex-1 border-r px-2 py-2 text-center text-xs font-medium',
                          isToday(day) && 'bg-primary/5 text-primary font-semibold',
                        )}
                      >
                        <div>{format(day, 'EEE')}</div>
                        <div className={cn(
                          'text-lg',
                          isToday(day) && 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground',
                        )}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Crew rows */}
                  {crews.map((crew) => (
                    <div key={crew.id} className="flex min-h-[72px]">
                      {weekDays.map((day) => {
                        const cellDate = format(day, 'yyyy-MM-dd');
                        const cellId = `cell-${crew.id}-${cellDate}`;
                        const dayJobs = getJobsForCell(crew.id, cellDate);

                        return (
                          <DroppableWeekCell
                            key={cellId}
                            cellId={cellId}
                            crewId={crew.id}
                            date={cellDate}
                            isToday={isToday(day)}
                          >
                            {dayJobs.map((job) => (
                              <JobPopover
                                key={job.id}
                                job={job}
                                open={popoverOpen && selectedJob?.id === job.id}
                                onOpenChange={(open) => {
                                  setPopoverOpen(open);
                                  if (!open) setSelectedJob(null);
                                }}
                                onUnassign={handleUnassign}
                              >
                                <div>
                                  <DraggableJobBlock
                                    job={job}
                                    onClick={(j) => {
                                      setSelectedJob(j);
                                      setPopoverOpen(true);
                                    }}
                                  />
                                </div>
                              </JobPopover>
                            ))}
                          </DroppableWeekCell>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!boardLoading && crews.length === 0 && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <LayoutGrid className="mx-auto h-12 w-12 opacity-50" />
                    <p className="mt-2">No active crews found</p>
                    <p className="text-sm">Adjust the division filter or check crew status</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Job Queue Sidebar */}
          {queueOpen && (
            <div className="w-80 flex-shrink-0 border-l flex flex-col bg-muted/20">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <h2 className="text-sm font-semibold">Job Queue</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setQueueOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Queue Tabs */}
              <Tabs value={queueTab} onValueChange={setQueueTab} className="px-3 pt-2">
                <TabsList className="w-full h-8">
                  <TabsTrigger value="all" className="text-xs flex-1">
                    All
                    {queueData && (
                      <span className="ml-1 text-[10px]">
                        ({new Set([
                          ...queueData.unassigned.map((j) => j.id),
                          ...queueData.work_orders.map((j) => j.id),
                          ...queueData.recurring_pending.map((j) => j.id),
                          ...queueData.overdue.map((j) => j.id),
                        ]).size})
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="unassigned" className="text-xs flex-1">
                    Unassigned
                    {queueData && <span className="ml-1 text-[10px]">({queueData.unassigned.length})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="overdue" className="text-xs flex-1">
                    Overdue
                    {queueData && <span className="ml-1 text-[10px]">({queueData.overdue.length})</span>}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search */}
              <div className="px-3 py-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    className="h-8 pl-8 text-sm"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Queue Items */}
              <ScrollArea className="flex-1 px-3 pb-3">
                {queueLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : filteredQueue.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {queueSearch ? 'No matching jobs' : 'Queue is empty'}
                  </div>
                ) : (
                  filteredQueue.map((job) => (
                    <DraggableQueueCard
                      key={job.id}
                      job={job}
                      isOverdue={overdueIds.has(job.id)}
                    />
                  ))
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeItem ? <DragOverlayCard job={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================
// Droppable Week Cell (with data passing)
// ============================================

function DroppableWeekCell({
  cellId,
  crewId,
  date,
  isToday: isTodayDate,
  children,
}: {
  cellId: string;
  crewId: string;
  date: string;
  isToday: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { crewId, date, time: '08:00' },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-h-[72px] border-b border-r p-1',
        isTodayDate && 'bg-primary/5',
        isOver && 'bg-primary/10',
      )}
    >
      {children}
    </div>
  );
}
