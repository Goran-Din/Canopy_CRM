import * as serviceHistoryRepo from './service-history.repository.js';

export async function getServiceHistory(tenantId: string, propertyId: string) {
  return serviceHistoryRepo.findByPropertyId(tenantId, propertyId);
}

export async function getEstimationContext(
  tenantId: string,
  propertyId: string,
  serviceCode: string,
  property: Record<string, unknown>,
) {
  const history = await serviceHistoryRepo.findByPropertyService(
    tenantId, propertyId, serviceCode,
  );

  const currentYear = new Date().getFullYear();
  const propertyCategory = property.property_category as string | undefined;

  const similarPricing = propertyCategory
    ? await serviceHistoryRepo.getSimilarPropertyPricing(
        tenantId, propertyCategory, serviceCode, currentYear,
      )
    : null;

  return {
    property: {
      address: `${property.address_line1 || ''}, ${property.city || ''} ${property.state || ''}`.trim(),
      category: propertyCategory,
      bed_area_sqft: property.bed_area_sqft,
      num_bushes_shrubs: property.num_bushes_shrubs,
      num_trees: property.num_trees,
    },
    service_history: {
      history_by_year: history.map(h => ({
        season_year: h.season_year,
        service_date: h.service_date,
        status: h.status,
        notes: h.notes,
      })),
    },
    similar_properties: similarPricing,
  };
}
