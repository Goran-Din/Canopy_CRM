import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().max(30).nullish(),
  roles: z.array(z.string()).optional(),
  divisions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).nullish(),
});

export const changePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const assignRoleSchema = z.object({
  role: z.enum(['owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member', 'client']),
  division_id: z.string().uuid().nullish(),
});

export const assignDivisionSchema = z.object({
  division: z.string().min(1),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  sortBy: z.enum(['first_name', 'last_name', 'email', 'created_at', 'last_login_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export const roleParamsSchema = z.object({
  id: z.string().uuid(),
  role: z.string(),
});

export const divisionParamsSchema = z.object({
  id: z.string().uuid(),
  division: z.string(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type AssignDivisionInput = z.infer<typeof assignDivisionSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
