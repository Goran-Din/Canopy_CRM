import { z } from 'zod';

const propertyTypes = ['residential', 'commercial', 'hoa', 'municipal', 'other'] as const;
const propertyStatuses = ['active', 'inactive', 'pending', 'archived'] as const;
const serviceFrequencies = ['weekly', 'biweekly', 'monthly', 'per_visit', 'seasonal', 'on_demand'] as const;

export const createPropertySchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  property_name: z.string().max(255).nullish(),
  property_type: z.enum(propertyTypes).default('residential'),
  status: z.enum(propertyStatuses).default('pending'),
  address_line1: z.string().max(255).nullish(),
  address_line2: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(50).nullish(),
  zip: z.string().max(20).nullish(),
  country: z.string().max(3).default('US'),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  lot_size_sqft: z.coerce.number().int().min(0).nullish(),
  lawn_area_sqft: z.coerce.number().int().min(0).nullish(),
  zone: z.string().max(50).nullish(),
  service_frequency: z.enum(serviceFrequencies).default('weekly'),
  property_photos_url: z.array(z.string().url()).nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).default([]),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID').optional(),
  property_name: z.string().max(255).nullish(),
  property_type: z.enum(propertyTypes).optional(),
  status: z.enum(propertyStatuses).optional(),
  address_line1: z.string().max(255).nullish(),
  address_line2: z.string().max(255).nullish(),
  city: z.string().max(100).nullish(),
  state: z.string().max(50).nullish(),
  zip: z.string().max(20).nullish(),
  country: z.string().max(3).optional(),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  lot_size_sqft: z.coerce.number().int().min(0).nullish(),
  lawn_area_sqft: z.coerce.number().int().min(0).nullish(),
  zone: z.string().max(50).nullish(),
  service_frequency: z.enum(serviceFrequencies).optional(),
  property_photos_url: z.array(z.string().url()).nullish(),
  notes: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  updated_at: z.string().datetime().optional(),
});

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const propertyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(propertyStatuses).optional(),
  type: z.enum(propertyTypes).optional(),
  zone: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  tag: z.string().optional(),
  sortBy: z
    .enum(['property_name', 'created_at', 'updated_at', 'status', 'city', 'zone'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PropertyQuery = z.infer<typeof propertyQuerySchema>;

export const propertyParamsSchema = z.object({
  id: z.string().uuid('Invalid property ID'),
});

export const customerParamsSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});
