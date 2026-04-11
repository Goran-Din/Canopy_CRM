import { z } from 'zod';

export const upsertBadgeSchema = z.object({
  id: z.string().uuid().optional(),
  badge_name: z.string().min(1).max(100),
  badge_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color'),
  badge_icon: z.string().max(50).optional(),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export type UpsertBadgeInput = z.infer<typeof upsertBadgeSchema>;

export const assignBadgesSchema = z.object({
  badge_ids: z.array(z.string().uuid()),
});

export type AssignBadgesInput = z.infer<typeof assignBadgesSchema>;
