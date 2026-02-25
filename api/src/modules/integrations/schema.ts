import { z } from 'zod';

const providers = ['xero', 'mautic', 'google_drive', 'canopy_quotes', 'canopy_ops', 'northchat'] as const;
const integrationStatuses = ['active', 'inactive', 'error', 'pending_setup'] as const;
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
