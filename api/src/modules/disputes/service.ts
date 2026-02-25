import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateDisputeInput,
  UpdateDisputeInput,
  ResolveDisputeInput,
  DisputeQuery,
  CreateCreditNoteInput,
  CreditNoteQuery,
} from './schema.js';
import * as repo from './repository.js';

// ======== DISPUTES ========

export async function listDisputes(tenantId: string, query: DisputeQuery) {
  const { rows, total } = await repo.findAllDisputes(tenantId, query);
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

export async function getDispute(tenantId: string, id: string) {
  const dispute = await repo.findDisputeById(tenantId, id);
  if (!dispute) {
    throw new AppError(404, 'Dispute not found');
  }
  return dispute;
}

export async function createDispute(
  tenantId: string,
  input: CreateDisputeInput,
  userId: string,
) {
  // Validate invoice exists
  const invoiceTotal = await repo.getInvoiceTotal(tenantId, input.invoice_id);
  if (invoiceTotal === null) {
    throw new AppError(404, 'Invoice not found in this tenant');
  }

  // Validate customer exists
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Disputed amount cannot exceed invoice total
  if (Number(input.disputed_amount) > invoiceTotal) {
    throw new AppError(400, 'Disputed amount cannot exceed invoice total');
  }

  const disputeNumber = await repo.generateDisputeNumber(tenantId);

  const data = {
    ...input,
    dispute_number: disputeNumber,
  };

  const dispute = await repo.createDispute(tenantId, data, userId);

  // Auto-set invoice status to disputed
  await repo.updateInvoiceStatus(tenantId, input.invoice_id, 'disputed', userId);

  return dispute;
}

export async function updateDispute(
  tenantId: string,
  id: string,
  input: UpdateDisputeInput,
  userId: string,
) {
  const existing = await repo.findDisputeById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Dispute not found');
  }

  // Only open/under_review disputes can be edited
  if (existing.status !== 'open' && existing.status !== 'under_review') {
    throw new AppError(409, `Cannot edit dispute with status '${existing.status}'. Only open or under_review disputes can be edited.`);
  }

  // If disputed_amount is being changed, validate it
  if (input.disputed_amount !== undefined) {
    const invoiceTotal = await repo.getInvoiceTotal(tenantId, existing.invoice_id);
    if (invoiceTotal !== null && Number(input.disputed_amount) > invoiceTotal) {
      throw new AppError(400, 'Disputed amount cannot exceed invoice total');
    }
  }

  const updated = await repo.updateDispute(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update dispute');
  }
  return updated;
}

export async function resolveDispute(
  tenantId: string,
  id: string,
  input: ResolveDisputeInput,
  userId: string,
) {
  const existing = await repo.findDisputeById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Dispute not found');
  }

  // Only open/under_review disputes can be resolved
  if (existing.status !== 'open' && existing.status !== 'under_review') {
    throw new AppError(409, `Cannot resolve dispute with status '${existing.status}'`);
  }

  // Resolve with credit requires credit_amount
  if (input.status === 'resolved_credit') {
    if (!input.credit_amount) {
      throw new AppError(400, 'Credit amount is required when resolving with credit');
    }
    if (!input.credit_reason) {
      throw new AppError(400, 'Credit reason is required when resolving with credit');
    }
  }

  const resolved = await repo.resolveDispute(
    tenantId, id, input.status, input.resolution_notes, userId,
  );
  if (!resolved) {
    throw new AppError(500, 'Failed to resolve dispute');
  }

  // If resolved with credit, auto-create credit note
  let creditNote = null;
  if (input.status === 'resolved_credit' && input.credit_amount) {
    const cnNumber = await repo.generateCreditNoteNumber(tenantId);
    creditNote = await repo.createCreditNote(tenantId, {
      invoice_id: existing.invoice_id,
      dispute_id: id,
      customer_id: existing.customer_id,
      credit_note_number: cnNumber,
      amount: input.credit_amount,
      reason: input.credit_reason || input.resolution_notes,
    }, userId);
  }

  return { dispute: resolved, credit_note: creditNote };
}

// ======== CREDIT NOTES ========

export async function listCreditNotes(tenantId: string, query: CreditNoteQuery) {
  const { rows, total } = await repo.findAllCreditNotes(tenantId, query);
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

export async function getCreditNote(tenantId: string, id: string) {
  const creditNote = await repo.findCreditNoteById(tenantId, id);
  if (!creditNote) {
    throw new AppError(404, 'Credit note not found');
  }
  return creditNote;
}

export async function createCreditNote(
  tenantId: string,
  input: CreateCreditNoteInput,
  userId: string,
) {
  // Validate invoice exists
  const invoiceOk = await repo.invoiceExists(tenantId, input.invoice_id);
  if (!invoiceOk) {
    throw new AppError(404, 'Invoice not found in this tenant');
  }

  // Validate customer exists
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  const cnNumber = await repo.generateCreditNoteNumber(tenantId);

  const data = {
    ...input,
    credit_note_number: cnNumber,
  };

  return repo.createCreditNote(tenantId, data, userId);
}

export async function approveCreditNote(
  tenantId: string,
  id: string,
  userId: string,
) {
  const existing = await repo.findCreditNoteById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Credit note not found');
  }

  if (existing.status !== 'draft') {
    throw new AppError(409, `Cannot approve credit note with status '${existing.status}'. Only draft credit notes can be approved.`);
  }

  const approved = await repo.approveCreditNote(tenantId, id, userId);
  if (!approved) {
    throw new AppError(500, 'Failed to approve credit note');
  }
  return approved;
}

export async function applyCreditNote(
  tenantId: string,
  id: string,
  userId: string,
) {
  const existing = await repo.findCreditNoteById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Credit note not found');
  }

  if (existing.status !== 'approved') {
    throw new AppError(409, `Cannot apply credit note with status '${existing.status}'. Only approved credit notes can be applied.`);
  }

  const applied = await repo.applyCreditNote(tenantId, id, userId);
  if (!applied) {
    throw new AppError(500, 'Failed to apply credit note');
  }

  // Increase amount_paid on the invoice (credit reduces balance)
  await repo.adjustInvoiceAmountPaid(tenantId, existing.invoice_id, Number(existing.amount));

  return applied;
}

export async function voidCreditNote(
  tenantId: string,
  id: string,
  userId: string,
) {
  const existing = await repo.findCreditNoteById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Credit note not found');
  }

  // Can void approved or applied credit notes
  if (existing.status !== 'approved' && existing.status !== 'applied') {
    throw new AppError(409, `Cannot void credit note with status '${existing.status}'. Only approved or applied credit notes can be voided.`);
  }

  const voided = await repo.voidCreditNote(tenantId, id, userId);
  if (!voided) {
    throw new AppError(500, 'Failed to void credit note');
  }

  // If it was applied, reverse the balance adjustment
  if (existing.status === 'applied') {
    await repo.adjustInvoiceAmountPaid(tenantId, existing.invoice_id, -Number(existing.amount));
  }

  return voided;
}

// --- Stats ---

export async function getDisputeStats(tenantId: string) {
  return repo.getStats(tenantId);
}
