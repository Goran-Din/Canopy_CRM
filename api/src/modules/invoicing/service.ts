import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceStatusInput,
  InvoiceQuery,
  AddLineItemInput,
  UpdateLineItemInput,
  RecordPaymentInput,
  GenerateFromContractInput,
  GenerateFromJobsInput,
} from './schema.js';
import * as repo from './repository.js';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['sent', 'draft', 'cancelled'],
  sent: ['viewed', 'paid', 'partially_paid', 'overdue', 'disputed', 'cancelled'],
  viewed: ['paid', 'partially_paid', 'overdue', 'disputed', 'cancelled'],
  partially_paid: ['paid', 'overdue', 'disputed', 'written_off'],
  overdue: ['paid', 'partially_paid', 'disputed', 'written_off', 'cancelled'],
  disputed: ['sent', 'cancelled', 'written_off'],
  paid: [],
  cancelled: ['draft'],
  written_off: [],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ======== INVOICES ========

export async function listInvoices(tenantId: string, query: InvoiceQuery) {
  const { rows, total } = await repo.findAllInvoices(tenantId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getInvoice(tenantId: string, id: string) {
  const invoice = await repo.findInvoiceById(tenantId, id);
  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }
  return invoice;
}

export async function createInvoice(
  tenantId: string,
  input: CreateInvoiceInput,
  userId: string,
) {
  // Validate customer
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Auto-generate invoice number
  const invoiceNumber = await repo.generateInvoiceNumber(tenantId);

  // Default invoice_date to today
  const invoiceDate = input.invoice_date || new Date().toISOString().split('T')[0];

  // Default due_date to invoice_date + 30 days
  let dueDate = input.due_date;
  if (!dueDate) {
    const d = new Date(invoiceDate);
    d.setUTCDate(d.getUTCDate() + 30);
    dueDate = d.toISOString().split('T')[0];
  }

  // Calculate totals from line items
  const lineItems = input.line_items || [];
  const subtotal = lineItems.reduce(
    (sum, li) => sum + Number(li.quantity) * Number(li.unit_price),
    0,
  );
  const lineTaxTotal = lineItems.reduce(
    (sum, li) => sum + Number(li.quantity) * Number(li.unit_price) * Number(li.tax_rate || 0),
    0,
  );
  const invoiceTax = subtotal * Number(input.tax_rate || 0);
  const taxAmount = lineTaxTotal + invoiceTax;
  const discountAmount = Number(input.discount_amount || 0);
  const total = subtotal + taxAmount - discountAmount;

  const data = {
    ...input,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    subtotal,
    tax_amount: taxAmount,
    total,
  };

  return repo.createInvoice(tenantId, data, lineItems, userId);
}

export async function updateInvoice(
  tenantId: string,
  id: string,
  input: UpdateInvoiceInput,
  userId: string,
) {
  const existing = await repo.findInvoiceById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Invoice not found');
  }

  // Only draft/pending invoices can be fully edited
  if (existing.status !== 'draft' && existing.status !== 'pending') {
    throw new AppError(409, `Cannot edit invoice with status '${existing.status}'. Only draft or pending invoices can be edited.`);
  }

  if (input.customer_id && input.customer_id !== existing.customer_id) {
    const customerOk = await repo.customerExists(tenantId, input.customer_id);
    if (!customerOk) {
      throw new AppError(404, 'Customer not found in this tenant');
    }
  }

  const data: Record<string, unknown> = { ...input };
  const updated = await repo.updateInvoice(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Invoice was modified by another user. Please refresh and try again.');
  }

  // Recalculate totals if tax_rate or discount changed
  if (input.tax_rate !== undefined || input.discount_amount !== undefined) {
    await repo.recalculateTotals(tenantId, id);
  }

  return repo.findInvoiceById(tenantId, id);
}

export async function changeStatus(
  tenantId: string,
  id: string,
  input: InvoiceStatusInput,
  userId: string,
) {
  const existing = await repo.findInvoiceById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Invoice not found');
  }

  if (existing.status === input.status) {
    return existing;
  }

  if (!isValidTransition(existing.status, input.status)) {
    throw new AppError(400, `Cannot transition from '${existing.status}' to '${input.status}'`);
  }

  const extraFields: Record<string, unknown> = {};

  // Record sent_at when moving to sent
  if (input.status === 'sent' && !existing.sent_at) {
    extraFields.sent_at = new Date().toISOString();
  }

  // Record paid_date when fully paid
  if (input.status === 'paid') {
    extraFields.paid_date = new Date().toISOString().split('T')[0];
  }

  const updated = await repo.updateStatus(
    tenantId, id, input.status, userId,
    Object.keys(extraFields).length > 0 ? extraFields : undefined,
  );
  if (!updated) {
    throw new AppError(500, 'Failed to update invoice status');
  }
  return updated;
}

export async function deleteInvoice(tenantId: string, id: string) {
  const existing = await repo.findInvoiceById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Invoice not found');
  }

  if (existing.status !== 'draft' && existing.status !== 'cancelled') {
    throw new AppError(
      409,
      `Cannot delete invoice with status '${existing.status}'. Only draft or cancelled invoices can be deleted.`,
    );
  }

  return repo.softDeleteInvoice(tenantId, id);
}

// --- Line Items ---

export async function addLineItem(
  tenantId: string,
  invoiceId: string,
  input: AddLineItemInput,
  userId: string,
) {
  const invoice = await repo.findInvoiceById(tenantId, invoiceId);
  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }

  if (invoice.status !== 'draft' && invoice.status !== 'pending') {
    throw new AppError(409, `Cannot modify line items on invoice with status '${invoice.status}'`);
  }

  const item = await repo.addLineItem(tenantId, invoiceId, input);
  await repo.recalculateTotals(tenantId, invoiceId);
  return item;
}

export async function updateLineItem(
  tenantId: string,
  lineItemId: string,
  input: UpdateLineItemInput,
  userId: string,
) {
  const existing = await repo.getLineItemById(tenantId, lineItemId);
  if (!existing) {
    throw new AppError(404, 'Line item not found');
  }

  // Check invoice status
  const invoice = await repo.findInvoiceById(tenantId, existing.invoice_id);
  if (invoice && invoice.status !== 'draft' && invoice.status !== 'pending') {
    throw new AppError(409, `Cannot modify line items on invoice with status '${invoice.status}'`);
  }

  const updated = await repo.updateLineItem(tenantId, lineItemId, input);
  if (!updated) {
    throw new AppError(500, 'Failed to update line item');
  }

  await repo.recalculateTotals(tenantId, existing.invoice_id);
  return updated;
}

export async function removeLineItem(
  tenantId: string,
  lineItemId: string,
  userId: string,
) {
  const existing = await repo.getLineItemById(tenantId, lineItemId);
  if (!existing) {
    throw new AppError(404, 'Line item not found');
  }

  const invoice = await repo.findInvoiceById(tenantId, existing.invoice_id);
  if (invoice && invoice.status !== 'draft' && invoice.status !== 'pending') {
    throw new AppError(409, `Cannot modify line items on invoice with status '${invoice.status}'`);
  }

  const removed = await repo.removeLineItem(tenantId, lineItemId);
  await repo.recalculateTotals(tenantId, existing.invoice_id);
  return removed;
}

// --- Payments ---

export async function recordPayment(
  tenantId: string,
  invoiceId: string,
  input: RecordPaymentInput,
  userId: string,
) {
  const invoice = await repo.findInvoiceById(tenantId, invoiceId);
  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }

  // Can only record payments on sent/viewed/partially_paid/overdue invoices
  const payableStatuses = ['sent', 'viewed', 'partially_paid', 'overdue'];
  if (!payableStatuses.includes(invoice.status)) {
    throw new AppError(409, `Cannot record payment on invoice with status '${invoice.status}'`);
  }

  const payment = await repo.recordPayment(tenantId, invoiceId, input, userId);
  const updated = await repo.updateAmountPaid(tenantId, invoiceId);

  if (updated) {
    const newAmountPaid = Number(updated.amount_paid);
    const invoiceTotal = Number(updated.total);

    // Auto-set status based on payment
    if (newAmountPaid >= invoiceTotal) {
      await repo.updateStatus(tenantId, invoiceId, 'paid', userId, {
        paid_date: new Date().toISOString().split('T')[0],
      });
    } else if (newAmountPaid > 0 && invoice.status !== 'partially_paid') {
      await repo.updateStatus(tenantId, invoiceId, 'partially_paid', userId);
    }
  }

  return payment;
}

export async function getPayments(tenantId: string, invoiceId: string) {
  const invoice = await repo.findInvoiceById(tenantId, invoiceId);
  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }
  return repo.getPayments(tenantId, invoiceId);
}

// --- Generate ---

export async function generateFromContract(
  tenantId: string,
  input: GenerateFromContractInput,
  userId: string,
) {
  const contractData = await repo.getContractWithLineItems(tenantId, input.contract_id);
  if (!contractData) {
    throw new AppError(404, 'Contract not found');
  }

  const { contract, line_items } = contractData;
  const invoiceNumber = await repo.generateInvoiceNumber(tenantId);

  const invoiceDate = new Date().toISOString().split('T')[0];
  let dueDate = input.due_date;
  if (!dueDate) {
    const d = new Date(invoiceDate);
    d.setUTCDate(d.getUTCDate() + 30);
    dueDate = d.toISOString().split('T')[0];
  }

  // Map contract line items to invoice line items
  const invoiceLineItems = line_items.map((cli, i) => ({
    description: String(cli.service_name || cli.description || ''),
    quantity: Number(cli.quantity || 1),
    unit_price: Number(cli.unit_price || 0),
    tax_rate: input.tax_rate || 0,
    sort_order: i,
  }));

  const subtotal = invoiceLineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price, 0,
  );
  const taxAmount = subtotal * (input.tax_rate || 0);
  const total = subtotal + taxAmount;

  const data = {
    customer_id: contract.customer_id,
    property_id: contract.property_id || null,
    contract_id: input.contract_id,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    subtotal,
    tax_rate: input.tax_rate || 0,
    tax_amount: taxAmount,
    total,
    division: contract.division || null,
    billing_period_start: input.billing_period_start,
    billing_period_end: input.billing_period_end,
    discount_amount: 0,
    currency: 'USD',
  };

  return repo.createInvoice(tenantId, data, invoiceLineItems, userId);
}

export async function generateFromJobs(
  tenantId: string,
  input: GenerateFromJobsInput,
  userId: string,
) {
  const jobs = await repo.getJobsForInvoice(tenantId, input.job_ids);
  if (jobs.length === 0) {
    throw new AppError(404, 'No valid jobs found');
  }

  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  const invoiceNumber = await repo.generateInvoiceNumber(tenantId);
  const invoiceDate = new Date().toISOString().split('T')[0];
  let dueDate = input.due_date;
  if (!dueDate) {
    const d = new Date(invoiceDate);
    d.setUTCDate(d.getUTCDate() + 30);
    dueDate = d.toISOString().split('T')[0];
  }

  const invoiceLineItems = jobs.map((job, i) => ({
    job_id: String(job.id),
    description: String(job.title || `Job ${job.id}`),
    quantity: 1,
    unit_price: Number(job.estimated_price || 0),
    tax_rate: input.tax_rate || 0,
    sort_order: i,
  }));

  const subtotal = invoiceLineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price, 0,
  );
  const taxAmount = subtotal * (input.tax_rate || 0);
  const total = subtotal + taxAmount;

  const data = {
    customer_id: input.customer_id,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDate,
    subtotal,
    tax_rate: input.tax_rate || 0,
    tax_amount: taxAmount,
    total,
    discount_amount: 0,
    currency: 'USD',
  };

  return repo.createInvoice(tenantId, data, invoiceLineItems, userId);
}

// --- Stats ---

export async function getInvoiceStats(tenantId: string) {
  return repo.getStats(tenantId);
}

export async function getAgingReport(tenantId: string) {
  return repo.getAgingReport(tenantId);
}
