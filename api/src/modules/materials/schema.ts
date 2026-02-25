import { z } from 'zod';

const materialCategories = [
  'salt', 'sand', 'mulch', 'soil', 'stone', 'fertilizer', 'seed',
  'ice_melt', 'fuel', 'plants', 'pavers', 'retaining_blocks', 'other',
] as const;
const materialUnits = ['ton', 'yard', 'bag', 'gallon', 'pallet', 'piece', 'sqft', 'lbs', 'other'] as const;
const transactionTypes = ['purchase', 'usage', 'adjustment', 'return'] as const;

export const createMaterialSchema = z.object({
  material_name: z.string().max(255),
  category: z.enum(materialCategories).default('other'),
  unit_of_measure: z.enum(materialUnits).default('other'),
  current_stock: z.coerce.number().min(0).default(0),
  reorder_level: z.coerce.number().min(0).nullish(),
  cost_per_unit: z.coerce.number().min(0).nullish(),
  preferred_supplier: z.string().max(255).nullish(),
  storage_location: z.string().max(255).nullish(),
  notes: z.string().nullish(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = createMaterialSchema.partial();

export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const materialQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  category: z.enum(materialCategories).optional(),
  low_stock: z.coerce.boolean().optional(),
  sortBy: z.enum(['material_name', 'category', 'current_stock', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type MaterialQuery = z.infer<typeof materialQuerySchema>;

export const materialParamsSchema = z.object({
  id: z.string().uuid('Invalid material ID'),
});

export const createTransactionSchema = z.object({
  transaction_type: z.enum(transactionTypes),
  quantity: z.coerce.number().positive(),
  unit_cost: z.coerce.number().min(0).nullish(),
  job_id: z.string().uuid().nullish(),
  notes: z.string().nullish(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  transaction_type: z.enum(transactionTypes).optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
