import { AppError } from '../../middleware/errorHandler.js';
import type {
  CreateSeasonInput,
  UpdateSeasonInput,
  SeasonQuery,
  CreateRunInput,
  UpdateRunInput,
  RunStatusInput,
  RunQuery,
  CreateEntryInput,
  UpdateEntryInput,
  EntryStatusInput,
} from './schema.js';
import * as repo from './repository.js';

// Valid run status transitions
const VALID_RUN_TRANSITIONS: Record<string, string[]> = {
  planned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['planned'],
};

// ======== SEASONS ========

export async function listSeasons(tenantId: string, query: SeasonQuery) {
  const { rows, total } = await repo.findAllSeasons(tenantId, query);
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

export async function getSeason(tenantId: string, id: string) {
  const season = await repo.findSeasonById(tenantId, id);
  if (!season) {
    throw new AppError(404, 'Season not found');
  }
  return season;
}

export async function createSeason(
  tenantId: string,
  input: CreateSeasonInput,
  userId: string,
) {
  // Only one season can be active at a time
  if (input.status === 'active') {
    const existing = await repo.getActiveSeason(tenantId);
    if (existing) {
      throw new AppError(409, `Season '${existing.season_name}' is already active. Only one season can be active at a time.`);
    }
  }

  return repo.createSeason(tenantId, input as Record<string, unknown>, userId);
}

export async function updateSeason(
  tenantId: string,
  id: string,
  input: UpdateSeasonInput,
  userId: string,
) {
  const existing = await repo.findSeasonById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Season not found');
  }

  // If setting to active, check no other active season
  if (input.status === 'active' && existing.status !== 'active') {
    const active = await repo.getActiveSeason(tenantId);
    if (active && active.id !== id) {
      throw new AppError(409, `Season '${active.season_name}' is already active. Only one season can be active at a time.`);
    }
  }

  const updated = await repo.updateSeason(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update season');
  }
  return updated;
}

export async function deleteSeason(tenantId: string, id: string) {
  const existing = await repo.findSeasonById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Season not found');
  }

  if (existing.status !== 'planning') {
    throw new AppError(409, `Cannot delete season with status '${existing.status}'. Only planning seasons can be deleted.`);
  }

  return repo.softDeleteSeason(tenantId, id);
}

// ======== RUNS ========

export async function listRuns(tenantId: string, query: RunQuery) {
  const { rows, total } = await repo.findAllRuns(tenantId, query);
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

export async function getRun(tenantId: string, id: string) {
  const run = await repo.findRunById(tenantId, id);
  if (!run) {
    throw new AppError(404, 'Run not found');
  }
  return run;
}

export async function createRun(
  tenantId: string,
  input: CreateRunInput,
  userId: string,
) {
  // Validate season exists and is planning/active
  const season = await repo.findSeasonById(tenantId, input.season_id);
  if (!season) {
    throw new AppError(404, 'Season not found');
  }
  if (season.status !== 'planning' && season.status !== 'active') {
    throw new AppError(409, `Cannot create runs for season with status '${season.status}'. Only planning or active seasons accept new runs.`);
  }

  const runNumber = await repo.generateRunNumber(tenantId, input.season_id);

  const data = {
    ...input,
    run_number: runNumber,
  };

  return repo.createRun(tenantId, data, userId);
}

export async function updateRun(
  tenantId: string,
  id: string,
  input: UpdateRunInput,
  userId: string,
) {
  const existing = await repo.findRunById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Run not found');
  }

  if (existing.status === 'completed' || existing.status === 'cancelled') {
    throw new AppError(409, `Cannot edit run with status '${existing.status}'`);
  }

  const updated = await repo.updateRun(tenantId, id, input as Record<string, unknown>, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update run');
  }
  return updated;
}

export async function changeRunStatus(
  tenantId: string,
  id: string,
  input: RunStatusInput,
  userId: string,
) {
  const existing = await repo.findRunById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Run not found');
  }

  if (existing.status === input.status) {
    return existing;
  }

  const allowed = VALID_RUN_TRANSITIONS[existing.status];
  if (!allowed || !allowed.includes(input.status)) {
    throw new AppError(400, `Cannot transition run from '${existing.status}' to '${input.status}'`);
  }

  const updated = await repo.updateRunStatus(tenantId, id, input.status, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update run status');
  }
  return updated;
}

// ======== ENTRIES ========

export async function addEntry(
  tenantId: string,
  runId: string,
  input: CreateEntryInput,
  userId: string,
) {
  const run = await repo.findRunById(tenantId, runId);
  if (!run) {
    throw new AppError(404, 'Run not found');
  }

  return repo.createEntry(tenantId, runId, input as Record<string, unknown>);
}

export async function bulkCreateEntries(
  tenantId: string,
  runId: string,
  userId: string,
) {
  const run = await repo.findRunById(tenantId, runId);
  if (!run) {
    throw new AppError(404, 'Run not found');
  }

  // Get all properties with active snow_removal contracts
  const contractProperties = await repo.getSnowContractProperties(tenantId);
  if (contractProperties.length === 0) {
    throw new AppError(404, 'No properties with active snow removal contracts found');
  }

  const entries = await repo.bulkCreateEntries(tenantId, runId, contractProperties);
  return entries;
}

export async function updateEntry(
  tenantId: string,
  entryId: string,
  input: UpdateEntryInput,
  userId: string,
) {
  const existing = await repo.findEntryById(tenantId, entryId);
  if (!existing) {
    throw new AppError(404, 'Entry not found');
  }

  // Calculate duration if both arrival and departure are provided
  const data: Record<string, unknown> = { ...input };
  const arrivalTime = input.arrival_time ?? existing.arrival_time;
  const departureTime = input.departure_time ?? existing.departure_time;

  if (arrivalTime && departureTime) {
    const arrival = new Date(arrivalTime);
    const departure = new Date(departureTime);
    const diffMs = departure.getTime() - arrival.getTime();
    if (diffMs > 0) {
      data.duration_minutes = Math.round(diffMs / 60000);
    }
  }

  const updated = await repo.updateEntry(tenantId, entryId, data);
  if (!updated) {
    throw new AppError(500, 'Failed to update entry');
  }
  return updated;
}

export async function changeEntryStatus(
  tenantId: string,
  entryId: string,
  input: EntryStatusInput,
  userId: string,
) {
  const existing = await repo.findEntryById(tenantId, entryId);
  if (!existing) {
    throw new AppError(404, 'Entry not found');
  }

  const updated = await repo.updateEntryStatus(tenantId, entryId, input.status, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update entry status');
  }

  // Update total_properties_serviced on the run
  if (input.status === 'completed' || existing.status === 'completed') {
    await repo.updateTotalPropertiesServiced(tenantId, existing.run_id);
  }

  return updated;
}

// ======== STATS ========

export async function getSnowStats(tenantId: string) {
  return repo.getStats(tenantId);
}
