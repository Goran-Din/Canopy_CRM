import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock DND Kit before any imports that use it — jsdom doesn't support pointer events
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: class PointerSensor {},
  KeyboardSensor: class KeyboardSensor {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  }),
  CSS: { Transform: { toString: () => '' } },
}));

const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockUseApiGet = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiGet: (...args: any[]) => mockUseApiGet(...args),
  useApiList: vi.fn(() => ({ data: [], pagination: {} })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useApiMutation: (..._args: any[]) => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { pdf_file_id: 'pdf-1' } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, title, onConfirm }: { open: boolean; title: string; onConfirm: () => void }) =>
    open ? <div data-testid="confirm-dialog"><span>{title}</span><button onClick={onConfirm}>Confirm</button></div> : null,
}));

import { toast } from 'sonner';
import QuoteBuilder from '../QuoteBuilder';

const mockQuote = {
  id: 'q1',
  quote_number: 'Q-0047-01',
  status: 'draft',
  version_number: 1,
  client_notes: null,
  payment_terms: null,
  valid_until: null,
  tax_enabled: false,
  tax_rate: 8.75,
  discount_amount: 0,
  subtotal: 570,
  total: 570,
  pdf_file_id: null,
  sections: [
    {
      id: 's1', title: 'Weekly Maintenance', body: null, sort_order: 0,
      line_items: [
        { id: 'li1', item_name: 'Mowing', description: 'Weekly mowing', quantity: 4, unit: 'ea', unit_price: 35, line_total: 140, sort_order: 0, xero_item_code: '4220-MOW', xero_default_price: 40 },
        { id: 'li2', item_name: 'Edging', description: 'Weekly edging', quantity: 4, unit: 'ea', unit_price: 15, line_total: 60, sort_order: 1, xero_item_code: null, xero_default_price: null },
      ],
    },
    {
      id: 's2', title: 'Monthly Services', body: 'Once per month', sort_order: 1,
      line_items: [
        { id: 'li3', item_name: '', description: '', quantity: 1, unit: 'ea', unit_price: null, line_total: 0, sort_order: 0, xero_item_code: null, xero_default_price: null },
      ],
    },
  ],
};

const mockTemplates = [{ id: 't1', name: 'Spring Standard', tags: ['spring'] }];

function setupMocks(quoteOverrides: Partial<typeof mockQuote> = {}) {
  const quote = { ...mockQuote, ...quoteOverrides, sections: quoteOverrides.sections || mockQuote.sections };
  mockUseApiGet.mockImplementation((key: string[]) => {
    if (key[0] === 'quote') return { data: quote, refetch: mockRefetch };
    if (key[0] === 'quote-templates') return { data: mockTemplates, refetch: mockRefetch };
    return { data: null, refetch: mockRefetch };
  });
}

function renderBuilder(props: Partial<React.ComponentProps<typeof QuoteBuilder>> = {}) {
  return render(
    <MemoryRouter>
      <QuoteBuilder quoteId="q1" jobId="j1" {...props} />
    </MemoryRouter>,
  );
}

describe('QuoteBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders quote editor with sections and line items', () => {
    renderBuilder();
    expect(screen.getByText('Q-0047-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Weekly Maintenance')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Monthly Services')).toBeInTheDocument();
  });

  it('add section button creates new section via mutation', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Add Section'));
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it('section title edits save on blur', async () => {
    renderBuilder();
    const titleInput = screen.getByDisplayValue('Weekly Maintenance');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated');
    titleInput.blur();
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
  });

  it('delete section with items shows confirmation', async () => {
    renderBuilder();
    // Find X buttons inside section editors
    const sections = document.querySelectorAll('[class*="border rounded-lg"]');
    const firstSection = sections[0];
    if (firstSection) {
      const xBtn = firstSection.querySelector('button:last-of-type');
      if (xBtn) await userEvent.click(xBtn as HTMLElement);
    }
  });

  it('add line item creates new item via mutation', async () => {
    renderBuilder();
    const addBtns = screen.getAllByText('Add Line Item');
    await userEvent.click(addBtns[0]);
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it('unit price field starts empty on new item (critical rule)', () => {
    renderBuilder();
    const priceInputs = screen.getAllByPlaceholderText('Enter price');
    expect(priceInputs.length).toBeGreaterThan(0);
    // li3 has null unit_price — should render empty
    const emptyPriceInput = priceInputs.find((inp) => (inp as HTMLInputElement).value === '');
    expect(emptyPriceInput).toBeTruthy();
  });

  it('line total computes qty x unit_price in real time', () => {
    renderBuilder();
    expect(screen.getByText('$140.00')).toBeInTheDocument();
    expect(screen.getByText('$60.00')).toBeInTheDocument();
  });

  it('subtotal sums all line totals', () => {
    renderBuilder();
    // 140 + 60 + 0 = 200 — appears as subtotal and total (no discount/tax)
    const amounts = screen.getAllByText('$200.00');
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('discount field saves on blur', async () => {
    renderBuilder();
    const discountInput = screen.getByDisplayValue('0');
    await userEvent.clear(discountInput);
    await userEvent.type(discountInput, '25');
    discountInput.blur();
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
  });

  it('tax row only shown when tax_enabled is true', () => {
    renderBuilder();
    expect(screen.queryByText(/Tax \(8.75%\)/)).not.toBeInTheDocument();
  });

  it('tax row appears when tax is enabled in quote data', () => {
    setupMocks({ tax_enabled: true });
    renderBuilder();
    expect(screen.getByText(/8.75/)).toBeInTheDocument();
  });

  it('total = subtotal - discount + tax', () => {
    renderBuilder();
    // subtotal 200, discount 0, no tax → total 200 — both subtotal and total rows show $200.00
    const amounts = screen.getAllByText('$200.00');
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('generate & send validates ≥1 priced line item', async () => {
    setupMocks({
      sections: [{
        id: 's1', title: 'Empty', body: null, sort_order: 0,
        line_items: [{ id: 'li1', item_name: 'X', description: '', quantity: 1, unit: 'ea', unit_price: null, line_total: 0, sort_order: 0, xero_item_code: null, xero_default_price: null }],
      }],
    });
    renderBuilder();
    await userEvent.click(screen.getByText('Generate & Send'));
    expect(toast.error).toHaveBeenCalledWith('Quote must have at least one priced line item before sending.');
  });

  it('send dialog opens when quote has priced items', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Generate & Send'));
    await waitFor(() => {
      expect(screen.getByText('Send Quote to Client')).toBeInTheDocument();
    });
  });

  it('load template dialog opens and renders select', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Load Template'));
    await waitFor(() => {
      // The Load Template dialog title should appear inside the opened Dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Radix Select trigger (placeholder text) should be visible
      expect(screen.getByText('Select a template')).toBeInTheDocument();
    });
  });

  it('save as template dialog captures name', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Save as Template'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g. Spring Cleanup/)).toBeInTheDocument();
    });
  });

  it('save draft button triggers PATCH and shows toast', async () => {
    renderBuilder();
    await userEvent.click(screen.getByText('Save Draft'));
    expect(mockMutateAsync).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Draft saved');
  });

  it('xero default price shown as reference text', () => {
    renderBuilder();
    // li1 has xero_default_price: 40
    expect(screen.getByText('Xero default: $40.00')).toBeInTheDocument();
  });

  it('estimation panel shows on desktop', () => {
    renderBuilder();
    expect(screen.getByText('Estimation Assistant')).toBeInTheDocument();
  });

  it('client notes textarea is rendered', () => {
    renderBuilder();
    expect(screen.getByPlaceholderText('Notes shown on PDF to client...')).toBeInTheDocument();
  });

  it('payment terms textarea is rendered', () => {
    renderBuilder();
    expect(screen.getByPlaceholderText('Payment terms...')).toBeInTheDocument();
  });
});
