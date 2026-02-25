import { AppError } from '../../middleware/errorHandler.js';
import type { CreateContactInput, UpdateContactInput, ContactQuery } from './schema.js';
import * as repo from './repository.js';

function generateDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

export async function listContacts(tenantId: string, query: ContactQuery) {
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

export async function getContact(tenantId: string, id: string) {
  const contact = await repo.findById(tenantId, id);
  if (!contact) {
    throw new AppError(404, 'Contact not found');
  }
  return contact;
}

export async function getContactsByCustomer(tenantId: string, customerId: string) {
  const exists = await repo.customerExists(tenantId, customerId);
  if (!exists) {
    throw new AppError(404, 'Customer not found');
  }
  return repo.findByCustomerId(tenantId, customerId);
}

export async function getContactsByProperty(tenantId: string, propertyId: string) {
  return repo.findByPropertyId(tenantId, propertyId);
}

export async function createContact(
  tenantId: string,
  input: CreateContactInput,
  userId: string,
) {
  // Validate customer exists in tenant
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Validate property belongs to same customer if provided
  if (input.property_id) {
    const propertyOk = await repo.propertyBelongsToCustomer(
      tenantId,
      input.property_id,
      input.customer_id,
    );
    if (!propertyOk) {
      throw new AppError(400, 'Property does not belong to this customer');
    }
  }

  // Auto-set as primary if this is the first contact for the customer
  const existingCount = await repo.countByCustomerId(tenantId, input.customer_id);
  let isPrimary = input.is_primary;
  if (existingCount === 0) {
    isPrimary = true;
  }

  // If setting as primary, unset existing primary first
  if (isPrimary && existingCount > 0) {
    // We'll handle this via setPrimary after creation
    // For now, create with is_primary=false, then set primary
    const displayName = generateDisplayName(input.first_name, input.last_name);
    const data = { ...input, display_name: displayName, is_primary: false };
    const created = await repo.create(tenantId, data, userId);
    await repo.setPrimary(tenantId, input.customer_id, created.id);
    // Re-fetch to get the updated is_primary
    const updated = await repo.findById(tenantId, created.id);
    return updated;
  }

  const displayName = generateDisplayName(input.first_name, input.last_name);
  const data = { ...input, display_name: displayName, is_primary: isPrimary };
  return repo.create(tenantId, data, userId);
}

export async function updateContact(
  tenantId: string,
  id: string,
  input: UpdateContactInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Contact not found');
  }

  // If changing customer_id, validate new customer
  if (input.customer_id && input.customer_id !== existing.customer_id) {
    const customerOk = await repo.customerExists(tenantId, input.customer_id);
    if (!customerOk) {
      throw new AppError(404, 'Customer not found in this tenant');
    }
  }

  // If property_id provided, validate it belongs to the effective customer
  const effectiveCustomerId = input.customer_id || existing.customer_id;
  if (input.property_id) {
    const propertyOk = await repo.propertyBelongsToCustomer(
      tenantId,
      input.property_id,
      effectiveCustomerId,
    );
    if (!propertyOk) {
      throw new AppError(400, 'Property does not belong to this customer');
    }
  }

  // Recompute display_name if name fields changed
  const firstName = input.first_name || existing.first_name;
  const lastName = input.last_name || existing.last_name;
  const displayName = generateDisplayName(firstName, lastName);

  // If setting is_primary=true, use setPrimary transaction
  if (input.is_primary === true && !existing.is_primary) {
    await repo.setPrimary(tenantId, effectiveCustomerId, id);
  }

  const data: Record<string, unknown> = {
    ...input,
    display_name: displayName,
    // Don't pass is_primary in the regular update — handled by setPrimary above
  };
  if (input.is_primary === true) {
    delete data.is_primary;
  }

  const updated = await repo.update(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Contact was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function deleteContact(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Contact not found');
  }

  // Block deletion of primary contact if other contacts exist
  if (existing.is_primary) {
    const count = await repo.countByCustomerId(tenantId, existing.customer_id);
    if (count > 1) {
      throw new AppError(
        409,
        'Cannot delete primary contact while other contacts exist. Reassign primary first.',
      );
    }
  }

  return repo.softDelete(tenantId, id);
}

export async function setPrimaryContact(
  tenantId: string,
  contactId: string,
) {
  const existing = await repo.findById(tenantId, contactId);
  if (!existing) {
    throw new AppError(404, 'Contact not found');
  }

  if (existing.is_primary) {
    return existing; // Already primary
  }

  const updated = await repo.setPrimary(tenantId, existing.customer_id, contactId);
  if (!updated) {
    throw new AppError(500, 'Failed to set primary contact');
  }
  return updated;
}
