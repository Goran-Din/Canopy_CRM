import { AppError } from '../../middleware/errorHandler.js';
import type {
  ClockInInput,
  ClockOutInput,
  UpdateEntryInput,
  EntryQuery,
  TimesheetQuery,
  DailySummaryQuery,
  WeeklySummaryQuery,
  CreateGpsEventInput,
  GpsUserQuery,
} from './schema.js';
import * as repo from './repository.js';

const LONG_SHIFT_THRESHOLD_MINUTES = 14 * 60; // 14 hours

// ======== TIME ENTRIES ========

export async function listEntries(tenantId: string, query: EntryQuery) {
  const { rows, total } = await repo.findAllEntries(tenantId, query);
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

export async function getEntry(tenantId: string, id: string) {
  const entry = await repo.findEntryById(tenantId, id);
  if (!entry) {
    throw new AppError(404, 'Time entry not found');
  }
  return entry;
}

export async function clockIn(
  tenantId: string,
  input: ClockInInput,
  userId: string,
  targetUserId?: string,
) {
  const effectiveUserId = targetUserId || userId;

  // Prevent double clock-in
  const active = await repo.getActiveClockIn(tenantId, effectiveUserId);
  if (active) {
    throw new AppError(409, 'User already has an active clock-in. Clock out first.');
  }

  const clockInTime = input.clock_in || new Date().toISOString();

  const data: Record<string, unknown> = {
    ...input,
    user_id: effectiveUserId,
    clock_in: clockInTime,
  };

  return repo.clockIn(tenantId, data, userId);
}

export async function clockOut(
  tenantId: string,
  id: string,
  input: ClockOutInput,
  userId: string,
) {
  const entry = await repo.findEntryById(tenantId, id);
  if (!entry) {
    throw new AppError(404, 'Time entry not found');
  }

  if (entry.status !== 'clocked_in') {
    throw new AppError(400, 'This entry is not currently clocked in');
  }

  const clockOutTime = input.clock_out || new Date().toISOString();
  const clockInDate = new Date(entry.clock_in);
  const clockOutDate = new Date(clockOutTime);

  // Validate clock_out is after clock_in
  if (clockOutDate <= clockInDate) {
    throw new AppError(400, 'Clock-out time must be after clock-in time');
  }

  // Calculate total_minutes
  const diffMs = clockOutDate.getTime() - clockInDate.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const breakMins = input.break_minutes ?? 0;
  const totalMinutes = diffMinutes - breakMins;

  const data: Record<string, unknown> = {
    ...input,
    clock_out: clockOutTime,
    break_minutes: breakMins,
    total_minutes: totalMinutes,
  };

  // Flag long shifts
  const needsReview = totalMinutes > LONG_SHIFT_THRESHOLD_MINUTES;

  const result = await repo.clockOut(tenantId, id, data, userId);
  if (!result) {
    throw new AppError(500, 'Failed to clock out');
  }

  if (needsReview) {
    return { ...result, _warning: 'Shift exceeds 14 hours — flagged for review' };
  }
  return result;
}

export async function updateEntry(
  tenantId: string,
  id: string,
  input: UpdateEntryInput,
  userId: string,
) {
  const existing = await repo.findEntryById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Time entry not found');
  }

  const data: Record<string, unknown> = { ...input };

  // Recalculate total_minutes if clock_in or clock_out changed
  const clockIn = input.clock_in || existing.clock_in;
  const clockOut = input.clock_out !== undefined ? input.clock_out : existing.clock_out;
  const breakMins = input.break_minutes ?? existing.break_minutes;

  if (clockOut) {
    const clockInDate = new Date(clockIn);
    const clockOutDate = new Date(clockOut);

    if (clockOutDate <= clockInDate) {
      throw new AppError(400, 'Clock-out time must be after clock-in time');
    }

    const diffMs = clockOutDate.getTime() - clockInDate.getTime();
    data.total_minutes = Math.round(diffMs / 60000) - breakMins;
  }

  // Mark as adjusted if admin is modifying times
  if (input.clock_in || input.clock_out !== undefined || input.break_minutes !== undefined) {
    data.status = input.status || 'adjusted';
  }

  const updated = await repo.updateEntry(tenantId, id, data, userId);
  if (!updated) {
    throw new AppError(500, 'Failed to update time entry');
  }
  return updated;
}

export async function approveEntry(
  tenantId: string,
  id: string,
  approvedBy: string,
) {
  const existing = await repo.findEntryById(tenantId, id);
  if (!existing) {
    throw new AppError(404, 'Time entry not found');
  }

  if (existing.status === 'clocked_in') {
    throw new AppError(400, 'Cannot approve an entry that is still clocked in');
  }

  if (existing.status === 'approved') {
    return existing; // already approved
  }

  const approved = await repo.approveEntry(tenantId, id, approvedBy);
  if (!approved) {
    throw new AppError(500, 'Failed to approve time entry');
  }
  return approved;
}

export async function getMyTimesheet(
  tenantId: string,
  userId: string,
  query: TimesheetQuery,
) {
  return repo.getByUserDateRange(tenantId, userId, query.date_from, query.date_to);
}

export async function getDailySummary(
  tenantId: string,
  query: DailySummaryQuery,
) {
  return repo.getDailySummary(tenantId, query.date, query.crew_id);
}

export async function getWeeklySummary(
  tenantId: string,
  query: WeeklySummaryQuery,
) {
  return repo.getWeeklySummary(tenantId, query.user_id, query.week_start);
}

// ======== GPS EVENTS ========

export async function recordGpsEvent(
  tenantId: string,
  input: CreateGpsEventInput,
  userId: string,
) {
  return repo.recordGpsEvent(tenantId, input, userId);
}

export async function getGpsEventsByJob(tenantId: string, jobId: string) {
  return repo.getEventsByJob(tenantId, jobId);
}

export async function getGpsEventsByUser(
  tenantId: string,
  userId: string,
  query: GpsUserQuery,
) {
  return repo.getEventsByUser(tenantId, userId, query.date_from, query.date_to);
}

export async function getLatestGpsByUser(tenantId: string, userId: string) {
  const event = await repo.getLatestByUser(tenantId, userId);
  if (!event) {
    throw new AppError(404, 'No GPS events found for this user');
  }
  return event;
}

// ======== HELPERS ========

export async function validateClockPermission(
  tenantId: string,
  requestingUserId: string,
  targetUserId: string,
  requestingRole: string,
) {
  // Crew members can only clock in/out for themselves
  if (requestingRole === 'crew_member' && requestingUserId !== targetUserId) {
    throw new AppError(403, 'Crew members can only manage their own time entries');
  }

  // Crew leaders can manage their crew members — verified at controller level
  // Owner/div_mgr can manage anyone
}
