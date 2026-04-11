import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockUseApiGet = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
  useApiList: vi.fn(() => ({ data: [], pagination: {} })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiMutation: (..._args: any[]) => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));

// Mock Leaflet and react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="map-marker">{children}</div>,
  Circle: ({ children }: { children: React.ReactNode }) => <div data-testid="map-circle">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => true) })),
  },
  divIcon: vi.fn(() => ({})),
  Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => true) })),
}));

import LiveCrewMapPage from '../LiveCrewMapPage';

const mockCrews = [
  {
    crew_id: 'cr1', crew_name: "Pablo's Crew", color_hex: '#2ecc71', division: 'landscaping_maintenance',
    status: 'on_site', lat: 41.76, lng: -88.32,
    current_property_address: '1348 Oak St', current_job_id: 'j1', current_job_number: '0047-26',
    arrived_at: new Date(Date.now() - 34 * 60000).toISOString(), last_gps_event_at: new Date().toISOString(),
    jobs_today: [
      { job_id: 'j0', job_number: '0046-26', property_address: '1607 Maple Dr', status: 'completed', scheduled_time: null, duration_minutes: 28 },
      { job_id: 'j1', job_number: '0047-26', property_address: '1348 Oak St', status: 'in_progress', scheduled_time: null, duration_minutes: null },
      { job_id: 'j2', job_number: '0048-26', property_address: '494 Village Grn', status: 'scheduled', scheduled_time: null, duration_minutes: null },
    ],
  },
  {
    crew_id: 'cr2', crew_name: "Maria's Crew", color_hex: '#3498db', division: 'landscaping_maintenance',
    status: 'in_transit', lat: 41.77, lng: -88.31,
    current_property_address: null, current_job_id: null, current_job_number: null,
    arrived_at: null, last_gps_event_at: new Date().toISOString(),
    jobs_today: [],
  },
  {
    crew_id: 'cr3', crew_name: "Carlos's Crew", color_hex: '#888', division: 'landscaping_maintenance',
    status: 'not_clocked_in', lat: null, lng: null,
    current_property_address: null, current_job_id: null, current_job_number: null,
    arrived_at: null, last_gps_event_at: null,
    jobs_today: [],
  },
];

const mockProperties = [
  { property_id: 'p1', address: '1348 Oak St, Aurora IL', lat: 41.76, lng: -88.32, geofence_radius_metres: 40, job_id: 'j1', job_number: '0047-26', crew_name: "Pablo's Crew", scheduled_time: null },
];

function setupMocks() {
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'live-crew-positions') return { data: { positions: mockCrews }, refetch: mockRefetch };
    if (key[0] === 'today-properties') return { data: { properties: mockProperties }, refetch: mockRefetch };
    return { data: null, refetch: mockRefetch };
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LiveCrewMapPage />
    </MemoryRouter>,
  );
}

describe('LiveCrewMap', () => {
  beforeEach(() => { vi.clearAllMocks(); setupMocks(); });

  it('renders map container and crew status panel', () => {
    renderPage();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText('Crew Status')).toBeInTheDocument();
  });

  it('shows crew count in header', () => {
    renderPage();
    // 2 active crews (on_site + in_transit, not counting not_clocked_in)
    expect(screen.getByText(/2 crews active/)).toBeInTheDocument();
  });

  it('shows last updated counter', () => {
    renderPage();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });

  it('refresh button exists', () => {
    renderPage();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('refresh button triggers refetch', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Refresh'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('crew markers rendered for crews with positions', () => {
    renderPage();
    const markers = screen.getAllByTestId('map-marker');
    expect(markers.length).toBeGreaterThanOrEqual(2); // Pablo + Maria have lat/lng
  });

  it('on-site crew shows green status in panel', () => {
    renderPage();
    expect(screen.getAllByText("Pablo's Crew").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ON SITE/).length).toBeGreaterThanOrEqual(1);
  });

  it('in-transit crew shows blue status', () => {
    renderPage();
    expect(screen.getAllByText("Maria's Crew").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IN TRANSIT/).length).toBeGreaterThanOrEqual(1);
  });

  it('not-clocked-in crew shows warning', () => {
    renderPage();
    expect(screen.getByText("Carlos's Crew")).toBeInTheDocument();
    expect(screen.getByText(/NOT CLOCKED IN/)).toBeInTheDocument();
  });

  it('geofence circles rendered for today properties', () => {
    renderPage();
    const circles = screen.getAllByTestId('map-circle');
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });

  it('crew row expands to show schedule', async () => {
    renderPage();
    // Click the crew row button in the status panel (the span inside the button)
    const pabloMatches = screen.getAllByText("Pablo's Crew");
    // Find the one inside a button element (the status panel row)
    const panelButton = pabloMatches.find((el) => el.closest('button'));
    await userEvent.click(panelButton!);
    // Expanded should show today's schedule
    expect(screen.getByText('1607 Maple Dr')).toBeInTheDocument();
    expect(screen.getByText('494 Village Grn')).toBeInTheDocument();
  });

  it('expanded crew shows View Jobs button', async () => {
    renderPage();
    const pabloMatches = screen.getAllByText("Pablo's Crew");
    const panelButton = pabloMatches.find((el) => el.closest('button'));
    await userEvent.click(panelButton!);
    expect(screen.getByText('View Jobs')).toBeInTheDocument();
  });

  it('Live Crew Map title shown', () => {
    renderPage();
    expect(screen.getByText('Live Crew Map')).toBeInTheDocument();
  });
});
