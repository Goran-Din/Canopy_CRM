import { z } from 'zod';

const contactTypes = ['primary', 'billing', 'site', 'emergency', 'other'] as const;
const contactMethods = ['email', 'phone', 'sms', 'any'] as const;

export const createContactSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  property_id: z.string().uuid('Invalid property ID').nullish(),
  contact_type: z.enum(contactTypes).default('other'),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email').max(255).nullish(),
  phone: z.string().max(30).nullish(),
  mobile: z.string().max(30).nullish(),
  job_title: z.string().max(100).nullish(),
  is_primary: z.boolean().default(false),
  preferred_contact_method: z.enum(contactMethods).default('any'),
  notes: z.string().nullish(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID').optional(),
  property_id: z.string().uuid('Invalid property ID').nullish(),
  contact_type: z.enum(contactTypes).optional(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email('Invalid email').max(255).nullish(),
  phone: z.string().max(30).nullish(),
  mobile: z.string().max(30).nullish(),
  job_title: z.string().max(100).nullish(),
  is_primary: z.boolean().optional(),
  preferred_contact_method: z.enum(contactMethods).optional(),
  notes: z.string().nullish(),
  updated_at: z.string().datetime().optional(),
});

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const contactQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  type: z.enum(contactTypes).optional(),
  sortBy: z
    .enum(['display_name', 'created_at', 'updated_at', 'contact_type', 'email'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ContactQuery = z.infer<typeof contactQuerySchema>;

export const contactParamsSchema = z.object({
  id: z.string().uuid('Invalid contact ID'),
});

export const customerParamsSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});

export const propertyParamsSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
});
