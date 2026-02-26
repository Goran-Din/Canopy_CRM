import { AppError } from '../../middleware/errorHandler.js';
import { hashPassword } from '../auth/service.js';
import * as repo from './repository.js';
import type { CreateUserInput, UpdateUserInput, UserQuery } from './schema.js';

export async function listUsers(tenantId: string, query: UserQuery) {
  const { rows, total } = await repo.findAll(tenantId, query);

  // Attach roles to each user
  const usersWithRoles = await Promise.all(
    rows.map(async (user) => {
      const roles = await repo.getUserRoles(tenantId, user.id);
      return {
        ...user,
        roles: roles.map((r) => ({
          role: r.role_name,
          division_id: r.division_id,
          division_name: r.division_name,
        })),
      };
    }),
  );

  return {
    data: usersWithRoles,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getUser(tenantId: string, id: string) {
  const user = await repo.findById(tenantId, id);
  if (!user) throw new AppError(404, 'User not found');

  const roles = await repo.getUserRoles(tenantId, id);
  return {
    ...user,
    roles: roles.map((r) => ({
      role: r.role_name,
      division_id: r.division_id,
      division_name: r.division_name,
    })),
  };
}

export async function createUser(tenantId: string, data: CreateUserInput) {
  const exists = await repo.emailExists(tenantId, data.email);
  if (exists) throw new AppError(409, 'Email already in use');

  const passwordHash = await hashPassword(data.password);
  const user = await repo.create(tenantId, {
    email: data.email,
    password_hash: passwordHash,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone ?? null,
  });

  // Assign roles if provided
  if (data.roles?.length) {
    for (const role of data.roles) {
      await repo.assignRole(tenantId, user.id, role);
    }
  }

  // Assign divisions if provided
  if (data.divisions?.length) {
    for (const div of data.divisions) {
      await repo.assignDivision(tenantId, user.id, div);
    }
  }

  return getUser(tenantId, user.id);
}

export async function updateUser(tenantId: string, id: string, data: UpdateUserInput) {
  const user = await repo.findById(tenantId, id);
  if (!user) throw new AppError(404, 'User not found');

  if (data.email && data.email !== user.email) {
    const exists = await repo.emailExists(tenantId, data.email, id);
    if (exists) throw new AppError(409, 'Email already in use');
  }

  const updated = await repo.update(tenantId, id, data);
  if (!updated) throw new AppError(404, 'User not found');

  return getUser(tenantId, id);
}

export async function changePassword(tenantId: string, id: string, password: string) {
  const user = await repo.findById(tenantId, id);
  if (!user) throw new AppError(404, 'User not found');

  const hash = await hashPassword(password);
  const success = await repo.updatePassword(tenantId, id, hash);
  if (!success) throw new AppError(500, 'Failed to update password');
}

export async function deactivateUser(tenantId: string, id: string) {
  const user = await repo.findById(tenantId, id);
  if (!user) throw new AppError(404, 'User not found');

  // Cannot deactivate the last owner
  const ownerCount = await repo.countByRole(tenantId, 'owner');
  const roles = await repo.getUserRoles(tenantId, id);
  const isOwner = roles.some((r) => r.role_name === 'owner');

  if (isOwner && ownerCount <= 1) {
    throw new AppError(400, 'Cannot deactivate the last owner');
  }

  const deactivated = await repo.deactivate(tenantId, id);
  if (!deactivated) throw new AppError(404, 'User not found');
  return getUser(tenantId, id);
}

export async function activateUser(tenantId: string, id: string) {
  const user = await repo.findById(tenantId, id);
  if (!user) throw new AppError(404, 'User not found');

  const activated = await repo.activate(tenantId, id);
  if (!activated) throw new AppError(404, 'User not found');
  return getUser(tenantId, id);
}

export async function addRole(tenantId: string, userId: string, roleName: string, divisionId: string | null = null) {
  const user = await repo.findById(tenantId, userId);
  if (!user) throw new AppError(404, 'User not found');

  await repo.assignRole(tenantId, userId, roleName, divisionId);
  return getUser(tenantId, userId);
}

export async function deleteRole(tenantId: string, userId: string, roleName: string) {
  const user = await repo.findById(tenantId, userId);
  if (!user) throw new AppError(404, 'User not found');

  // Cannot remove owner role from the last owner
  if (roleName === 'owner') {
    const ownerCount = await repo.countByRole(tenantId, 'owner');
    if (ownerCount <= 1) {
      throw new AppError(400, 'Cannot remove the last owner role');
    }
  }

  await repo.removeRole(tenantId, userId, roleName);
  return getUser(tenantId, userId);
}

export async function addDivision(tenantId: string, userId: string, divisionName: string) {
  const user = await repo.findById(tenantId, userId);
  if (!user) throw new AppError(404, 'User not found');

  await repo.assignDivision(tenantId, userId, divisionName);
  return getUser(tenantId, userId);
}

export async function deleteDivision(tenantId: string, userId: string, divisionName: string) {
  const user = await repo.findById(tenantId, userId);
  if (!user) throw new AppError(404, 'User not found');

  await repo.removeDivision(tenantId, userId, divisionName);
  return getUser(tenantId, userId);
}

export async function getUserStats(tenantId: string) {
  return repo.getStats(tenantId);
}
