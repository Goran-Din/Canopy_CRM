import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn(), patch: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <div data-testid="confirm-dialog"><button onClick={onConfirm}>Confirm</button></div> : null,
}));
vi.mock('@/components/files/PhotoGrid', () => ({ PhotoGrid: () => <div data-testid="photo-grid">PhotoGrid</div> }));
vi.mock('@/components/files/FileList', () => ({ FileList: () => <div data-testid="file-list">FileList</div> }));
vi.mock('@/components/files/FileUploadDialog', () => ({ FileUploadDialog: () => null }));
vi.mock('@/components/files/useFileUpload', () => ({
  useFileUpload: () => ({ upload: vi.fn(), reset: vi.fn(), progress: 0, isUploading: false, error: null }),
}));

import JobCard from '../JobCard';

const mockJob = {
  id: 'j1', job_number: '0047-26', title: 'Spring Cleanup', status: 'scheduled',
  priority: 'normal', division: 'Landscape', job_type: 'maintenance',
  customer_id: 'c1', customer_display_name: 'John Smith',
  property_id: 'p1', property_name: '1348 Oak St', property_address: '1348 Oak Street',
  property_city: 'Naperville', property_state: 'IL', property_zip: '60540',
  property_category: 'Residential', property_lot_size: '8,500 sqft',
  contract_id: 'ct1', contract_tier: 'Gold Package', contract_price: '145',
  contract_season_start: '2026-04-01', contract_season_end: '2026-11-30',
  description: null, scheduled_date: '2026-04-15', scheduled_start_time: null,
  estimated_duration_minutes: 60, assigned_crew_id: 'cr1', assigned_crew_name: 'Alpha Team',
  crew_leader_name: 'Mike Johnson', special_crew_instructions: 'Gate code: 4521. Park on street, not driveway.',
  dogs_on_property: 'yes', notes: null,
  occurrence_number: 3, total_occurrences: 32, last_visited: '2026-04-06',
  quote_id: null, created_at: '2026-01-01',
};

const mockDiary = [
  { id: 'd1', entry_type: 'note_added', content: 'Gate was locked', created_by_name: 'Mike J', created_at: '2026-04-06T15:00:00Z' },
  { id: 'd2', entry_type: 'system', content: 'Status changed to scheduled', created_by_name: null, created_at: '2026-04-05T10:00:00Z' },
];

const mockInvoices = [
  { id: 'inv1', invoice_number: 'INV-001', status: 'sent', total: '145.00', due_date: '2026-05-01', paid_date: null },
];

const mockHistory = [
  { id: 'h1', from_status: 'unscheduled', to_status: 'scheduled', changed_by_name: 'Admin', notes: null, created_at: '2026-04-05T10:00:00Z' },
];

function setupMocks(jobOverrides: Partial<typeof mockJob> = {}) {
  const job = { ...mockJob, ...jobOverrides };
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'job') return { data: job, isLoading: false, refetch: mockRefetch };
    if (key[0] === 'diary') return { data: mockDiary, refetch: mockRefetch };
    if (key[0] === 'job-invoices') return { data: mockInvoices, refetch: mockRefetch };
    if (key[0] === 'job-milestones') return { data: [], refetch: mockRefetch };
    if (key[0] === 'job-history') return { data: mockHistory, refetch: mockRefetch };
    if (key[0] === 'quote') return { data: null, refetch: mockRefetch };
    if (key[0] === 'folders') return { data: [], refetch: mockRefetch };
    if (key[0] === 'files') return { data: [], refetch: mockRefetch };
    if (key[0] === 'photos') return { data: [], refetch: mockRefetch };
    return { data: null, isLoading: false, refetch: mockRefetch };
  });
}

function renderJobCard(path = '/jobs/j1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobCard />} />
        <Route path="/jobs/:id/:tab" element={<JobCard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders header with job number, status badge, customer name', () => {
    renderJobCard();
    expect(screen.getByText(/Job #0047-26/)).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('shows all 7 tabs', () => {
    renderJobCard();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Quote')).toBeInTheDocument();
    expect(screen.getByText('Diary')).toBeInTheDocument();
    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('default tab is overview when no tab in URL', () => {
    renderJobCard('/jobs/j1');
    expect(screen.getByText('Property Snapshot')).toBeInTheDocument();
  });

  it('tab navigation updates URL', async () => {
    renderJobCard();
    await userEvent.click(screen.getByRole('tab', { name: 'Diary' }));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/j1/diary', { replace: true });
  });

  it('deep-link to specific tab works', () => {
    renderJobCard('/jobs/j1/diary');
    expect(screen.getByText('Add Note')).toBeInTheDocument();
  });

  it('overview tab shows property snapshot and contract info', () => {
    renderJobCard();
    expect(screen.getByText(/1348 Oak Street/)).toBeInTheDocument();
    expect(screen.getByText(/Gold Package/)).toBeInTheDocument();
    expect(screen.getByText(/3 of 32/)).toBeInTheDocument();
  });

  it('special instructions banner shown when field is set', () => {
    renderJobCard();
    expect(screen.getByText(/Gate code: 4521/)).toBeInTheDocument();
  });

  it('dog warning shown when dogs_on_property = yes', () => {
    renderJobCard();
    expect(screen.getByText('Dog on property')).toBeInTheDocument();
  });

  it('quick action buttons change based on job status', () => {
    renderJobCard();
    expect(screen.getByText('Start Job')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('diary tab shows entries', () => {
    renderJobCard('/jobs/j1/diary');
    expect(screen.getByText('Gate was locked')).toBeInTheDocument();
    expect(screen.getByText(/Status changed to scheduled/)).toBeInTheDocument();
  });

  it('add note form submits diary entry', async () => {
    renderJobCard('/jobs/j1/diary');
    await userEvent.click(screen.getByRole('button', { name: /Add Note/i }));
    const textarea = screen.getByPlaceholderText('Write a note...');
    await userEvent.type(textarea, 'Test note');
    // Click the submit "Add Note" button (inside the form)
    const buttons = screen.getAllByRole('button', { name: /Add Note/i });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it('photos tab renders PhotoGrid', () => {
    renderJobCard('/jobs/j1/photos');
    expect(screen.getByTestId('photo-grid')).toBeInTheDocument();
  });

  it('billing tab shows invoices table', () => {
    renderJobCard('/jobs/j1/billing');
    expect(screen.getByText('INV-001')).toBeInTheDocument();
  });

  it('history tab shows status change log', () => {
    renderJobCard('/jobs/j1/history');
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('quote tab shows create button when no quote exists', () => {
    renderJobCard('/jobs/j1/quote');
    expect(screen.getByText('No quote created yet.')).toBeInTheDocument();
    expect(screen.getByText('Create Quote')).toBeInTheDocument();
  });

  it('quote tab shows placeholder for draft quote', () => {
    mockUseApiGet.mockImplementation((key: string[]) => {
      if (key[0] === 'job') return { data: { ...mockJob, quote_id: 'q1' }, isLoading: false, refetch: mockRefetch };
      if (key[0] === 'quote') return { data: { id: 'q1', quote_number: 'Q-0047-01', status: 'draft', total: '500', sections: [], versions: [] }, refetch: mockRefetch };
      return { data: null, isLoading: false, refetch: mockRefetch };
    });
    renderJobCard('/jobs/j1/quote');
    expect(screen.getByText(/Quote Builder will be rendered here/)).toBeInTheDocument();
  });

  it('back button navigates to previous page', async () => {
    renderJobCard();
    // Back button is the first ghost button with ArrowLeft
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
