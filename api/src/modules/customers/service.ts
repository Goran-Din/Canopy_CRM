import { AppError } from '../../middleware/errorHandler.js';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from './schema.js';
import * as repo from './repository.js';

function generateDisplayName(
  customerType: string,
  firstName: string,
  lastName: string,
  companyName?: string | null,
): string {
  if (customerType === 'commercial' && companyName) {
    return companyName;
  }
  return `${firstName} ${lastName}`;
}

export async function listCustomers(tenantId: string, query: CustomerQuery) {
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

export async function getCustomer(tenantId: string, id: string) {
  const customer = await repo.findById(tenantId, id);
  if (!customer) {
    throw new AppError(404, 'Customer not found');
  }
  return customer;
}

export async function createCustomer(
  tenantId: string,
  input: CreateCustomerInput,
  userId: string,
) {
  // Duplicate email check within tenant
  if (input.email) {
    const existing = await repo.findByEmail(tenantId, input.email);
    if (existing) {
      throw new AppError(409, 'A customer with this email already exists');
    }
  }

  const displayName = generateDisplayName(
    input.customer_type,
    input.first_name,
    input.last_name,
    input.company_name,
  );

  const data = { ...input, display_name: displayName };
  return repo.create(tenantId, data, userId);
}

export async function updateCustomer(
  tenantId: string,
  id: string,
  input: UpdateCustomerInput,
  userId: string,
) {
  // Verify customer exists
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Customer not found');
  }

  // If changing to commercial, ensure company_name is present
  const effectiveType = input.customer_type || existing.customer_type;
  if (effectiveType === 'commercial') {
    const effectiveCompany = input.company_name !== undefined ? input.company_name : existing.company_name;
    if (!effectiveCompany || effectiveCompany.trim().length === 0) {
      throw new AppError(400, 'Company name is required for commercial customers');
    }
  }

  // Duplicate email check within tenant (exclude current customer)
  if (input.email) {
    const duplicate = await repo.findByEmail(tenantId, input.email, id);
    if (duplicate) {
      throw new AppError(409, 'A customer with this email already exists');
    }
  }

  // Recompute display_name if relevant fields changed
  const firstName = input.first_name || existing.first_name;
  const lastName = input.last_name || existing.last_name;
  const companyName = input.company_name !== undefined ? input.company_name : existing.company_name;
  const displayName = generateDisplayName(effectiveType, firstName, lastName, companyName);

  const data: Record<string, unknown> = { ...input, display_name: displayName };

  const updated = await repo.update(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Customer was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function deleteCustomer(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Customer not found');
  }

  // Block deletion if active contracts exist
  const hasContracts = await repo.hasActiveContracts(tenantId, id);
  if (hasContracts) {
    throw new AppError(409, 'Cannot delete customer with active contracts');
  }

  return repo.softDelete(tenantId, id);
}

export async function getCustomerStats(tenantId: string) {
  return repo.getStats(tenantId);
}
