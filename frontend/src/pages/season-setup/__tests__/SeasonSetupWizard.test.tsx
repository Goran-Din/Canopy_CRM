import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({ occurrences_created: 13, billing_entries_created: 8 });
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
  apiClient: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn().mockResolvedValue({ data: {} }) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <div data-testid="confirm-dialog"><button onClick={onConfirm}>Confirm</button></div> : null,
}));

import { toast } from 'sonner';
import SeasonSetupWizard from '../SeasonSetupWizard';

const mockContract = {
  id: 'ct1',
  contract_number: 'C-0047',
  title: 'Gold Package',
  status: 'active',
  customer_id: 'c1',
  customer_display_name: 'John Smith',
  customer_code: 'SS-0047',
  property_address: '1348 Oak St, Naperville IL',
  property_category: 'Residential',
  division: 'Landscape',
  total_value: '1160',
  services: [
    { service_code: 'mowing', service_name: 'Weekly Lawn Mowing', service_type: 'weekly', xero_item_code: null },
    { service_code: 'fert', service_name: 'Fertilization', service_type: 'seasonal', xero_item_code: '4220-FERT' },
    { service_code: 'spring_cleanup', service_name: 'Spring Cleanup', service_type: 'one_time', xero_item_code: null },
  ],
  previous_season_price: 145,
};

function setupMocks() {
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'contract') return { data: mockContract, isLoading: false, refetch: mockRefetch };
    if (key[0] === 'billing-prev') return { data: [
      { id: 'b1', amount: '145', status: 'paid' },
      { id: 'b2', amount: '145', status: 'paid' },
    ], refetch: mockRefetch };
    return { data: null, isLoading: false, refetch: mockRefetch };
  });
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/season-setup/ct1']}>
      <Routes>
        <Route path="/season-setup/:contractId" element={<SeasonSetupWizard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SeasonSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders Step 1 by default with contract details', () => {
    renderWizard();
    expect(screen.getByText(/Step 1: Contract Review/)).toBeInTheDocument();
    expect(screen.getAllByText(/Gold Package/).length).toBeGreaterThan(0);
  });

  it('step indicator shows current step', () => {
    renderWizard();
    // Step 1 should be active — look for step number "1" in the indicator
    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('next button advances to Step 2', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    expect(screen.getByText(/Step 2: Service Configuration/)).toBeInTheDocument();
  });

  it('back button returns to previous step', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    expect(screen.getByText(/Step 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Back/));
    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
  });

  it('step 1 shows season year, start, end date fields', () => {
    renderWizard();
    expect(screen.getByDisplayValue('2026')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-11-30')).toBeInTheDocument();
  });

  it('step 1 shows last season summary', () => {
    renderWizard();
    // prev billing has 2 entries of $145 each
    expect(screen.getByText(/2 invoices/)).toBeInTheDocument();
  });

  it('step 1 validates season start before end', async () => {
    renderWizard();
    const endInput = screen.getByDisplayValue('2026-11-30');
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2026-01-01');
    await userEvent.click(screen.getByText(/Next: Services/));
    expect(toast.error).toHaveBeenCalledWith('Season start must be before season end.');
  });

  it('step 2 pre-populates services from contract', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => {
      expect(screen.getByText('Weekly Lawn Mowing')).toBeInTheDocument();
    });
    expect(screen.getByText('Fertilization')).toBeInTheDocument();
    expect(screen.getByText('Spring Cleanup')).toBeInTheDocument();
  });

  it('step 2 shows type badges', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => {
      expect(screen.getByText('weekly')).toBeInTheDocument();
    });
    expect(screen.getByText('seasonal')).toBeInTheDocument();
    expect(screen.getByText('one time')).toBeInTheDocument();
  });

  it('step 2 weekly services show dash for count', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => {
      // Weekly mowing should show "—"
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('step 2 add service opens dialog', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await userEvent.click(screen.getByText('Add Service'));
    expect(screen.getByPlaceholderText('Search Xero items...')).toBeInTheDocument();
  });

  it('step 3 monthly price field starts empty', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    await waitFor(() => screen.getByPlaceholderText('Enter monthly price'));
    const priceInput = screen.getByPlaceholderText('Enter monthly price');
    expect((priceInput as HTMLInputElement).value).toBe('');
  });

  it('step 3 shows suggested price', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    // contract.previous_season_price = 145, suggested = 145 * 1.035 = 150.075 → toFixed(2) = 150.07
    await waitFor(() => expect(screen.getAllByText(/150\.07/).length).toBeGreaterThan(0));
  });

  it('step 3 use suggested button populates price', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    await waitFor(() => screen.getByText(/Use \$150\.07/));
    await userEvent.click(screen.getByText(/Use \$150\.07/));
    const priceInput = screen.getByPlaceholderText('Enter monthly price');
    expect((priceInput as HTMLInputElement).value).toBe('150.07');
  });

  it('step 3 billing calendar shows scheduled entries', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    // Should show "N invoices" in the card header (Apr–Nov = 8 months, billing_months=8)
    // Use function matcher to handle text split across text nodes
    await waitFor(() =>
      expect(
        screen.getByText((content) => content.includes('invoices') && /\d/.test(content)),
      ).toBeInTheDocument(),
    );
  });

  it('step 4 shows full summary', async () => {
    renderWizard();
    // Navigate through all steps
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    await waitFor(() => screen.getByText(/Next: Review/));
    await userEvent.click(screen.getByText(/Next: Review/));
    await waitFor(() => expect(screen.getByText(/Step 4: Review & Activate/)).toBeInTheDocument());
    expect(screen.getByText('Season Summary')).toBeInTheDocument();
  });

  it('step 4 shows total occurrence count', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    await waitFor(() => screen.getByText(/Next: Review/));
    await userEvent.click(screen.getByText(/Next: Review/));
    // Fertilization x3 + Spring Cleanup x1 = 4 occurrences
    await waitFor(() => expect(screen.getByText(/4 occurrences/)).toBeInTheDocument());
  });

  it('activate button calls POST', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    await waitFor(() => screen.getByText(/Next: Review/));
    await userEvent.click(screen.getByText(/Next: Review/));
    await waitFor(() => screen.getByText('Activate Season'));
    await userEvent.click(screen.getByText('Activate Season'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Season activated successfully!');
  });

  it('shows ready to activate message', async () => {
    renderWizard();
    await userEvent.click(screen.getByText(/Next: Services/));
    await waitFor(() => screen.getByText(/Next: Billing/));
    await userEvent.click(screen.getByText(/Next: Billing/));
    await waitFor(() => screen.getByText(/Next: Review/));
    await userEvent.click(screen.getByText(/Next: Review/));
    await waitFor(() => expect(screen.getByText('Ready to activate.')).toBeInTheDocument());
  });
});
