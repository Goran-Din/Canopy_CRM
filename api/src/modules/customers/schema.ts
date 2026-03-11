import { z } from 'zod';

const customerTypes = ['residential', 'commercial'] as const;
const customerStatuses = ['active', 'inactive', 'suspended', 'prospect', 'archived'] as const;
const customerSources = ['referral', 'website', 'mautic', 'manual', 'other'] as const;

export const createCustomerSchema = z
  .object({
    customer_type: z.enum(customerTypes).default('residential'),
    status: z.enum(customerStatuses).default('prospect'),
    source: z.enum(customerSources).default('manual'),
    company_name: z.string().max(255).nullish(),
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Invalid email').max(255).nullish(),
    phone: z.string().max(30).nullish(),
    mobile: z.string().max(30).nullish(),
    billing_address_line1: z.string().max(255).nullish(),
    billing_address_line2: z.string().max(255).nullish(),
    billing_city: z.string().max(100).nullish(),
    billing_state: z.string().max(50).nullish(),
    billing_zip: z.string().max(20).nullish(),
    billing_country: z.string().max(3).default('US'),
    notes: z.string().nullish(),
    tags: z.array(z.string()).default([]),
    referred_by_customer_id: z.string().uuid().nullish(),
    xero_contact_id: z.string().max(255).nullish(),
  })
  .refine(
    (data) => data.customer_type !== 'commercial' || (data.company_name && data.company_name.trim().length > 0),
    { message: 'Company name is required for commercial customers', path: ['company_name'] },
  );

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({
    customer_type: z.enum(customerTypes).optional(),
    status: z.enum(customerStatuses).optional(),
    source: z.enum(customerSources).optional(),
    company_name: z.string().max(255).nullish(),
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    email: z.string().email('Invalid email').max(255).nullish(),
    phone: z.string().max(30).nullish(),
    mobile: z.string().max(30).nullish(),
    billing_address_line1: z.string().max(255).nullish(),
    billing_address_line2: z.string().max(255).nullish(),
    billing_city: z.string().max(100).nullish(),
    billing_state: z.string().max(50).nullish(),
    billing_zip: z.string().max(20).nullish(),
    billing_country: z.string().max(3).optional(),
    notes: z.string().nullish(),
    tags: z.array(z.string()).optional(),
    referred_by_customer_id: z.string().uuid().nullish(),
    xero_contact_id: z.string().max(255).nullish(),
    updated_at: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.customer_type === 'commercial') {
        return data.company_name && data.company_name.trim().length > 0;
      }
      return true;
    },
    { message: 'Company name is required for commercial customers', path: ['company_name'] },
  );

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.enum(customerStatuses).optional(),
  type: z.enum(customerTypes).optional(),
  tag: z.string().optional(),
  sortBy: z
    .enum(['display_name', 'customer_number', 'created_at', 'updated_at', 'status', 'email'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CustomerQuery = z.infer<typeof customerQuerySchema>;

export const customerParamsSchema = z.object({
  id: z.string().uuid('Invalid customer ID'),
});
