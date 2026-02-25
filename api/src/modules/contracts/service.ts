import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateContractInput,
  UpdateContractInput,
  StatusChangeInput,
  ContractQuery,
  CreateLineItemInput,
  UpdateLineItemInput,
} from './schema.js';
import * as repo from './repository.js';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['active', 'draft', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
  completed: ['active'], // reactivation
  cancelled: ['draft'],  // re-draft
  expired: ['draft'],    // re-draft
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function listContracts(tenantId: string, query: ContractQuery) {
  const { rows, total } = await repo.findAll(tenantId, query);
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

export async function getContract(tenantId: string, id: string) {
  const contract = await repo.findById(tenantId, id);
  if (!contract) {
    throw new AppError(404, 'Contract not found');
  }
  return contract;
}

export async function createContract(
  tenantId: string,
  input: CreateContractInput,
  userId: string,
) {
  // Validate customer exists in tenant
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Validate property belongs to customer
  const propertyOk = await repo.propertyBelongsToCustomer(
    tenantId,
    input.property_id,
    input.customer_id,
  );
  if (!propertyOk) {
    throw new AppError(400, 'Property does not belong to this customer');
  }

  // Auto-generate contract number
  const contractNumber = await repo.generateContractNumber(tenantId);

  // Calculate contract_value from line items if not explicitly set
  let contractValue = input.contract_value;
  if ((contractValue == null || contractValue === 0) && input.line_items.length > 0) {
    contractValue = input.line_items.reduce(
      (sum, li) => sum + li.quantity * li.unit_price,
      0,
    );
  }

  const data = {
    ...input,
    contract_number: contractNumber,
    contract_value: contractValue,
  };

  return repo.create(tenantId, data, input.line_items, userId);
}

export async function updateContract(
  tenantId: string,
  id: string,
  input: UpdateContractInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Contract not found');
  }

  // If changing customer_id, validate new customer
  const effectiveCustomerId = input.customer_id || existing.customer_id;
  if (input.customer_id && input.customer_id !== existing.customer_id) {
    const customerOk = await repo.customerExists(tenantId, input.customer_id);
    if (!customerOk) {
      throw new AppError(404, 'Customer not found in this tenant');
    }
  }

  // If changing property_id, validate it belongs to the effective customer
  if (input.property_id && input.property_id !== existing.property_id) {
    const propertyOk = await repo.propertyBelongsToCustomer(
      tenantId,
      input.property_id,
      effectiveCustomerId,
    );
    if (!propertyOk) {
      throw new AppError(400, 'Property does not belong to this customer');
    }
  }

  // Log price change if contract_value changed
  if (
    input.contract_value !== undefined &&
    input.contract_value !== existing.contract_value
  ) {
    await repo.logPriceChange(
      tenantId,
      id,
      existing.contract_value,
      input.contract_value,
      null,
      userId,
    );
  }

  const data: Record<string, unknown> = { ...input };
  const updated = await repo.update(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Contract was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function changeStatus(
  tenantId: string,
  id: string,
  input: StatusChangeInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Contract not found');
  }

  if (existing.status === input.status) {
    return existing; // Already in the target status
  }

  if (!isValidTransition(existing.status, input.status)) {
    throw new AppError(
      400,
      `Cannot transition from '${existing.status}' to '${input.status}'`,
    );
  }

  const updated = await repo.updateStatus(tenantId, id, input.status, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update contract status');
  }
  return updated;
}

export async function deleteContract(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Contract not found');
  }

  // Only allow deletion of draft or cancelled contracts
  if (existing.status !== 'draft' && existing.status !== 'cancelled') {
    throw new AppError(
      409,
      `Cannot delete contract with status '${existing.status}'. Only draft or cancelled contracts can be deleted.`,
    );
  }

  return repo.softDelete(tenantId, id);
}

// --- Line Items ---

export async function getLineItems(tenantId: string, contractId: string) {
  const contract = await repo.findById(tenantId, contractId);
  if (!contract) {
    throw new AppError(404, 'Contract not found');
  }
  return repo.getLineItems(tenantId, contractId);
}

export async function addLineItem(
  tenantId: string,
  contractId: string,
  input: CreateLineItemInput,
  userId: string,
) {
  const contract = await repo.findById(tenantId, contractId);
  if (!contract) {
    throw new AppError(404, 'Contract not found');
  }

  const item = await repo.addLineItem(tenantId, contractId, input);

  // Recalculate contract_value from all line items
  await recalculateContractValue(tenantId, contractId, userId);

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

  const updated = await repo.updateLineItem(tenantId, lineItemId, input);
  if (!updated) {
    throw new AppError(500, 'Failed to update line item');
  }

  // Recalculate contract_value
  await recalculateContractValue(tenantId, existing.contract_id, userId);

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

  const removed = await repo.removeLineItem(tenantId, lineItemId);

  // Recalculate contract_value
  await recalculateContractValue(tenantId, existing.contract_id, userId);

  return removed;
}

async function recalculateContractValue(
  tenantId: string,
  contractId: string,
  userId: string,
) {
  const items = await repo.getLineItems(tenantId, contractId);
  const total = items.reduce(
    (sum, li) => sum + Number(li.quantity) * Number(li.unit_price),
    0,
  );
  await repo.update(tenantId, contractId, { contract_value: total }, userId);
}

export async function getContractStats(tenantId: string) {
  return repo.getStats(tenantId);
}
