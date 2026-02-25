import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateCrewInput,
  UpdateCrewInput,
  CrewQuery,
  CrewMemberInput,
  CreateRouteInput,
  UpdateRouteInput,
  RouteQuery,
  CreateStopInput,
  UpdateStopInput,
  ReorderStopsInput,
} from './schema.js';
import * as repo from './repository.js';

// ======== CREWS ========

export async function listCrews(tenantId: string, query: CrewQuery) {
  const { rows, total } = await repo.findAllCrews(tenantId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getCrew(tenantId: string, id: string) {
  const crew = await repo.findCrewById(tenantId, id);
  if (!crew) {
    throw new AppError(404, 'Crew not found');
  }
  return crew;
}

export async function createCrew(
  tenantId: string,
  input: CreateCrewInput,
  userId: string,
) {
  // Validate crew leader exists if provided
  if (input.crew_leader_id) {
    const leaderOk = await repo.userExists(tenantId, input.crew_leader_id);
    if (!leaderOk) {
      throw new AppError(404, 'Crew leader user not found in this tenant');
    }
  }

  return repo.createCrew(tenantId, input, userId);
}

export async function updateCrew(
  tenantId: string,
  id: string,
  input: UpdateCrewInput,
  userId: string,
) {
  const existing = await repo.findCrewById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Crew not found');
  }

  // Validate crew leader if changing
  if (input.crew_leader_id) {
    const leaderOk = await repo.userExists(tenantId, input.crew_leader_id);
    if (!leaderOk) {
      throw new AppError(404, 'Crew leader user not found in this tenant');
    }
  }

  const data: Record<string, unknown> = { ...input };
  const updated = await repo.updateCrew(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Crew was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function deleteCrew(tenantId: string, id: string) {
  const existing = await repo.findCrewById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Crew not found');
  }

  // Block deletion if crew has active jobs
  const activeJobs = await repo.hasActiveJobs(tenantId, id);
  if (activeJobs) {
    throw new AppError(409, 'Cannot delete crew with active jobs (scheduled or in_progress). Reassign or complete them first.');
  }

  return repo.softDeleteCrew(tenantId, id);
}

// --- Crew Members ---

export async function getCrewMembers(tenantId: string, crewId: string) {
  const exists = await repo.crewExists(tenantId, crewId);
  if (!exists) {
    throw new AppError(404, 'Crew not found');
  }
  return repo.getCrewMembers(tenantId, crewId);
}

export async function addCrewMember(
  tenantId: string,
  crewId: string,
  input: CrewMemberInput,
) {
  const exists = await repo.crewExists(tenantId, crewId);
  if (!exists) {
    throw new AppError(404, 'Crew not found');
  }

  const userOk = await repo.userExists(tenantId, input.user_id);
  if (!userOk) {
    throw new AppError(404, 'User not found in this tenant');
  }

  const alreadyMember = await repo.isUserActiveMemberOfCrew(tenantId, crewId, input.user_id);
  if (alreadyMember) {
    throw new AppError(409, 'User is already an active member of this crew');
  }

  return repo.addCrewMember(tenantId, crewId, input.user_id, input.role_in_crew);
}

export async function removeCrewMember(
  tenantId: string,
  crewId: string,
  userId: string,
) {
  const exists = await repo.crewExists(tenantId, crewId);
  if (!exists) {
    throw new AppError(404, 'Crew not found');
  }

  const removed = await repo.removeCrewMember(tenantId, crewId, userId);
  if (!removed) {
    throw new AppError(404, 'Member not found in this crew');
  }
  return removed;
}

// ======== ROUTES ========

export async function listRoutes(tenantId: string, query: RouteQuery) {
  const { rows, total } = await repo.findAllRoutes(tenantId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getRoute(tenantId: string, id: string) {
  const route = await repo.findRouteById(tenantId, id);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }
  return route;
}

export async function createRoute(
  tenantId: string,
  input: CreateRouteInput,
  userId: string,
) {
  // Validate crew exists if provided
  if (input.crew_id) {
    const crewOk = await repo.crewExists(tenantId, input.crew_id);
    if (!crewOk) {
      throw new AppError(404, 'Crew not found in this tenant');
    }
  }

  return repo.createRoute(tenantId, input, userId);
}

export async function updateRoute(
  tenantId: string,
  id: string,
  input: UpdateRouteInput,
  userId: string,
) {
  const existing = await repo.findRouteById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Route not found');
  }

  // Validate crew if changing
  if (input.crew_id) {
    const crewOk = await repo.crewExists(tenantId, input.crew_id);
    if (!crewOk) {
      throw new AppError(404, 'Crew not found in this tenant');
    }
  }

  const data: Record<string, unknown> = { ...input };
  const updated = await repo.updateRoute(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(409, 'Route was modified by another user. Please refresh and try again.');
  }
  return updated;
}

export async function deleteRoute(tenantId: string, id: string) {
  const existing = await repo.findRouteById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Route not found');
  }

  return repo.softDeleteRoute(tenantId, id);
}

// --- Route Stops ---

export async function getRouteStops(tenantId: string, routeId: string) {
  const exists = await repo.findRouteById(tenantId, routeId);
  if (!exists) {
    throw new AppError(404, 'Route not found');
  }
  return repo.getRouteStops(tenantId, routeId);
}

export async function addStop(
  tenantId: string,
  routeId: string,
  input: CreateStopInput,
) {
  const route = await repo.findRouteById(tenantId, routeId);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  const propOk = await repo.propertyExists(tenantId, input.property_id);
  if (!propOk) {
    throw new AppError(404, 'Property not found in this tenant');
  }

  return repo.addStop(tenantId, routeId, input);
}

export async function updateStop(
  tenantId: string,
  stopId: string,
  input: UpdateStopInput,
) {
  const existing = await repo.getStopById(tenantId, stopId);
  if (!existing) {
    throw new AppError(404, 'Route stop not found');
  }

  const updated = await repo.updateStop(tenantId, stopId, input);
  if (!updated) {
    throw new AppError(500, 'Failed to update route stop');
  }
  return updated;
}

export async function removeStop(tenantId: string, stopId: string) {
  const existing = await repo.getStopById(tenantId, stopId);
  if (!existing) {
    throw new AppError(404, 'Route stop not found');
  }

  return repo.removeStop(tenantId, stopId);
}

export async function reorderStops(
  tenantId: string,
  routeId: string,
  input: ReorderStopsInput,
) {
  const route = await repo.findRouteById(tenantId, routeId);
  if (!route) {
    throw new AppError(404, 'Route not found');
  }

  await repo.reorderStops(tenantId, routeId, input.stop_ids);
  return repo.getRouteStops(tenantId, routeId);
}
