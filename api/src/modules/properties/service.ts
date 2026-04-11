import { AppError } from '../../middleware/errorHandler.js';
import type { CreatePropertyInput, UpdatePropertyInput, PropertyQuery, UpdatePropertyProfileInput, AddCrewNoteInput } from './schema.js';
import * as repo from './repository.js';
import * as serviceHistoryService from './service-history/service-history.service.js';
import * as geofenceService from '../geofence/service.js';

function generateGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export async function listProperties(tenantId: string, query: PropertyQuery) {
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

export async function getProperty(tenantId: string, id: string) {
  const property = await repo.findById(tenantId, id);
  if (!property) {
    throw new AppError(404, 'Property not found');
  }
  return property;
}

export async function getPropertiesByCustomer(tenantId: string, customerId: string) {
  // Validate customer exists in this tenant
  const exists = await repo.customerExists(tenantId, customerId);
  if (!exists) {
    throw new AppError(404, 'Customer not found');
  }
  return repo.findByCustomerId(tenantId, customerId);
}

export async function createProperty(
  tenantId: string,
  input: CreatePropertyInput,
  userId: string,
) {
  // Validate customer exists and belongs to tenant
  const customerOk = await repo.customerExists(tenantId, input.customer_id);
  if (!customerOk) {
    throw new AppError(404, 'Customer not found in this tenant');
  }

  // Auto-generate Google Maps URL from lat/lng
  let googleMapsUrl: string | null = null;
  if (input.latitude != null && input.longitude != null) {
    googleMapsUrl = generateGoogleMapsUrl(input.latitude, input.longitude);
  }

  const data = { ...input, google_maps_url: googleMapsUrl };
  const property = await repo.create(tenantId, data, userId);

  // Auto-set default geofence from property GPS coordinates
  if (input.latitude != null && input.longitude != null) {
    geofenceService.setDefaultGeofence(
      property.id, input.latitude, input.longitude,
      (input as Record<string, unknown>).property_category as string | undefined,
    ).catch(() => {
      // Geofence setup failure should not fail property creation
    });
  }

  return property;
}

export async function updateProperty(
  tenantId: string,
  id: string,
  input: UpdatePropertyInput,
  userId: string,
) {
  // Verify property exists
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Property not found');
  }

  // If changing customer_id, validate new customer exists in tenant
  if (input.customer_id && input.customer_id !== existing.customer_id) {
    const customerOk = await repo.customerExists(tenantId, input.customer_id);
    if (!customerOk) {
      throw new AppError(404, 'Customer not found in this tenant');
    }
  }

  // Recompute Google Maps URL if lat/lng changed
  const effectiveLat = input.latitude !== undefined ? input.latitude : existing.latitude;
  const effectiveLng = input.longitude !== undefined ? input.longitude : existing.longitude;

  let googleMapsUrl: string | null = existing.google_maps_url;
  if (input.latitude !== undefined || input.longitude !== undefined) {
    if (effectiveLat != null && effectiveLng != null) {
      googleMapsUrl = generateGoogleMapsUrl(effectiveLat, effectiveLng);
    } else {
      googleMapsUrl = null;
    }
  }

  const data: Record<string, unknown> = { ...input, google_maps_url: googleMapsUrl };

  const updated = await repo.update(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Property was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function deleteProperty(tenantId: string, id: string) {
  const existing = await repo.findById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Property not found');
  }

  // Block deletion if active contracts exist
  const hasContracts = await repo.hasActiveContracts(tenantId, id);
  if (hasContracts) {
    throw new AppError(409, 'Cannot delete property with active contracts');
  }

  return repo.softDelete(tenantId, id);
}

export async function getPropertyStats(tenantId: string) {
  return repo.getStats(tenantId);
}

// --- V2 Functions ---

export async function updateProfile(
  tenantId: string,
  propertyId: string,
  input: UpdatePropertyProfileInput,
) {
  const existing = await repo.findById(tenantId, propertyId);
  if (!existing) throw new AppError(404, 'Property not found');

  const updated = await repo.updateProfile(tenantId, propertyId, input);
  if (!updated) throw new AppError(500, 'Failed to update property profile');
  return updated;
}

export async function getKnowledgeCard(tenantId: string, propertyId: string) {
  const card = await repo.getKnowledgeCard(tenantId, propertyId);
  if (!card) throw new AppError(404, 'Property not found');
  return card;
}

export async function getServiceHistory(tenantId: string, propertyId: string) {
  const existing = await repo.findById(tenantId, propertyId);
  if (!existing) throw new AppError(404, 'Property not found');
  return serviceHistoryService.getServiceHistory(tenantId, propertyId);
}

export async function getEstimationContext(
  tenantId: string,
  propertyId: string,
  serviceCode: string,
) {
  const property = await repo.findById(tenantId, propertyId);
  if (!property) throw new AppError(404, 'Property not found');
  return serviceHistoryService.getEstimationContext(tenantId, propertyId, serviceCode, property as Record<string, unknown>);
}

export async function getCrewNotes(tenantId: string, propertyId: string) {
  const existing = await repo.findById(tenantId, propertyId);
  if (!existing) throw new AppError(404, 'Property not found');
  return repo.findCrewNotes(tenantId, propertyId);
}

export async function addCrewNote(
  tenantId: string,
  propertyId: string,
  input: AddCrewNoteInput,
  userId: string,
) {
  const existing = await repo.findById(tenantId, propertyId);
  if (!existing) throw new AppError(404, 'Property not found');
  return repo.insertCrewNote(tenantId, propertyId, input.note, userId);
}

export async function getPropertyPhotos(tenantId: string, propertyId: string) {
  const existing = await repo.findById(tenantId, propertyId);
  if (!existing) throw new AppError(404, 'Property not found');
  return repo.getPropertyPhotos(tenantId, propertyId);
}

export async function getJobHistory(tenantId: string, propertyId: string) {
  const existing = await repo.findById(tenantId, propertyId);
  if (!existing) throw new AppError(404, 'Property not found');
  return repo.getJobHistory(tenantId, propertyId);
}

export async function getCategorySummary(tenantId: string) {
  return repo.getCategorySummary(tenantId);
}
