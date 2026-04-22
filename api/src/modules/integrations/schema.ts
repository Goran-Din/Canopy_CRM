import { z } from 'zod';

const providers = ['xero', 'mautic', 'google_drive', 'canopy_quotes', 'canopy_ops', 'northchat'] as const;
const syncStatuses = ['pending', 'success', 'failed', 'skipped'] as const;

// ======== Integration Config ========

export const providerParamsSchema = z.object({
  provider: z.enum(providers),
});

export const updateConfigSchema = z.object({
  config_data: z.record(z.unknown()).optional(),
  webhook_secret: z.string().max(255).nullish(),
});

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

export const connectSchema = z.object({
  authorization_code: z.string().optional(),
  redirect_uri: z.string().optional(),
  config_data: z.record(z.unknown()).optional(),
});

export type ConnectInput = z.infer<typeof connectSchema>;

// ======== Sync Log ========

export const syncLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  provider: z.enum(providers).optional(),
  entity_type: z.string().optional(),
  status: z.enum(syncStatuses).optional(),
  sortBy: z.enum(['created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SyncLogQuery = z.infer<typeof syncLogQuerySchema>;

export const entityParamsSchema = z.object({
  entityId: z.string().uuid('Invalid entity ID'),
});

// ======== Xero Sync ========

export const customerSyncParamsSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});

export const invoiceSyncParamsSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
});

export const paymentSyncParamsSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
});

// ======== Stub Integration Params ========

export const prospectParamsSchema = z.object({
  prospectId: z.string().uuid('Invalid prospect ID'),
});

export const quoteParamsSchema = z.object({
  quoteId: z.string().uuid('Invalid quote ID'),
});

// ======== Canopy Quotes Conversion ========

export const convertQuoteSchema = z.object({
  source_quote_number: z.string().min(1),
  source_system: z.literal('canopy_quotes'),
  customer: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    company_name: z.string().optional(),
  }),
  property: z.object({
    address_line1: z.string().min(1),
    address_line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    property_category: z.string().optional(),
  }),
  job: z.object({
    job_type: z.enum(['landscape_maintenance', 'landscape_project', 'hardscape', 'snow_removal']),
    division: z.string().optional(),
    description: z.string().optional(),
    estimated_value: z.coerce.number().optional(),
    notes: z.string().optional(),
  }),
  idempotency_key: z.string().optional(),
});

export type ConvertQuoteInput = z.infer<typeof convertQuoteSchema>;

// ======== NorthChat Webhook ========

export const northchatWebhookSchema = z.object({
  northchat_thread_id: z.string().min(1),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  customer_name: z.string().optional(),
  thread_url: z.string().url(),
  thread_summary: z.string().optional(),
  job_id: z.string().uuid().optional(),
  job_number: z.string().optional(),
});

export type NorthChatWebhookInput = z.infer<typeof northchatWebhookSchema>;

// ======== NorthChat Job Lookup ========

export const jobLookupSchema = z.object({
  job_number: z.string().min(1),
});
