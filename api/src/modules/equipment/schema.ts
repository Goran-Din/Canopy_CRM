import { z } from 'zod';

const equipmentTypes = [
  'truck', 'trailer', 'mower', 'plow', 'salter', 'skid_steer',
  'excavator', 'hand_tool', 'blower', 'trimmer', 'other',
] as const;
const equipmentStatuses = ['active', 'maintenance', 'out_of_service', 'retired', 'sold'] as const;
const divisionTypes = ['landscaping_maintenance', 'landscaping_projects', 'hardscape', 'snow_removal'] as const;

export const createEquipmentSchema = z.object({
  equipment_name: z.string().max(255),
  equipment_type: z.enum(equipmentTypes).default('other'),
  make: z.string().max(100).nullish(),
  model: z.string().max(100).nullish(),
  year: z.coerce.number().int().nullish(),
  serial_number: z.string().max(100).nullish(),
  license_plate: z.string().max(20).nullish(),
  vin: z.string().max(50).nullish(),
  purchase_date: z.string().nullish(),
  purchase_price: z.coerce.number().min(0).nullish(),
  current_value: z.coerce.number().min(0).nullish(),
  assigned_crew_id: z.string().uuid().nullish(),
  assigned_division: z.enum(divisionTypes).nullish(),
  last_maintenance_date: z.string().nullish(),
  next_maintenance_date: z.string().nullish(),
  mileage: z.coerce.number().int().min(0).nullish(),
  hours_used: z.coerce.number().min(0).nullish(),
  notes: z.string().nullish(),
});

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;

export const updateEquipmentSchema = createEquipmentSchema.partial().extend({
  status: z.enum(equipmentStatuses).optional(),
});

export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;

export const equipmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  equipment_type: z.enum(equipmentTypes).optional(),
  status: z.enum(equipmentStatuses).optional(),
  assigned_crew_id: z.string().uuid().optional(),
  sortBy: z.enum(['equipment_name', 'equipment_type', 'status', 'created_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type EquipmentQuery = z.infer<typeof equipmentQuerySchema>;

export const equipmentParamsSchema = z.object({
  id: z.string().uuid('Invalid equipment ID'),
});
