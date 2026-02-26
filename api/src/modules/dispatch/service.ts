import { AppError } from '../../middleware/errorHandler.js';
import * as repo from './repository.js';
import type { BoardQuery, AssignJobData, RescheduleJobData, UnassignJobData } from './schema.js';

export async function getBoardData(tenantId: string, query: BoardQuery) {
  const { start_date, end_date, division } = query;
  const data = await repo.getBoardData(tenantId, start_date, end_date, division);
  return data;
}

export async function getQueueData(tenantId: string) {
  return repo.getQueueData(tenantId);
}

export async function assignJob(tenantId: string, userId: string, input: AssignJobData) {
  const { job_id, crew_id, scheduled_date, scheduled_start_time } = input;

  const jobValid = await repo.jobExists(tenantId, job_id);
  if (!jobValid) {
    throw new AppError(404, 'Job not found');
  }

  const crewActive = await repo.crewIsActive(tenantId, crew_id);
  if (!crewActive) {
    throw new AppError(400, 'Crew is not active or does not belong to this tenant');
  }

  const result = await repo.assignJob(tenantId, job_id, crew_id, scheduled_date, scheduled_start_time, userId);
  if (!result) {
    throw new AppError(500, 'Failed to assign job');
  }

  return result;
}

export async function rescheduleJob(tenantId: string, userId: string, input: RescheduleJobData) {
  const { job_id, crew_id, scheduled_date, scheduled_start_time } = input;

  const jobValid = await repo.jobExists(tenantId, job_id);
  if (!jobValid) {
    throw new AppError(404, 'Job not found');
  }

  if (crew_id) {
    const crewActive = await repo.crewIsActive(tenantId, crew_id);
    if (!crewActive) {
      throw new AppError(400, 'Crew is not active or does not belong to this tenant');
    }
  }

  if (!crew_id && !scheduled_date && !scheduled_start_time) {
    throw new AppError(400, 'At least one field (crew_id, scheduled_date, scheduled_start_time) must be provided');
  }

  const result = await repo.rescheduleJob(tenantId, job_id, userId, crew_id, scheduled_date, scheduled_start_time);
  if (!result) {
    throw new AppError(500, 'Failed to reschedule job');
  }

  return result;
}

export async function unassignJob(tenantId: string, userId: string, input: UnassignJobData) {
  const { job_id } = input;

  const jobValid = await repo.jobExists(tenantId, job_id);
  if (!jobValid) {
    throw new AppError(404, 'Job not found');
  }

  const result = await repo.unassignJob(tenantId, job_id, userId);
  if (!result) {
    throw new AppError(500, 'Failed to unassign job');
  }

  return result;
}
