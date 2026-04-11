import { AppError } from '../../../middleware/errorHandler.js';
import * as badgesRepo from './badges.repository.js';
import * as jobRepo from '../repository.js';
import type { UpsertBadgeInput, AssignBadgesInput } from './badges.schema.js';

export async function listBadges(tenantId: string) {
  return badgesRepo.findAll(tenantId);
}

export async function upsertBadge(
  tenantId: string,
  input: UpsertBadgeInput,
) {
  return badgesRepo.upsert(tenantId, input);
}

export async function assignBadgesToJob(
  tenantId: string,
  jobId: string,
  input: AssignBadgesInput,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  // Validate all badge IDs exist
  for (const badgeId of input.badge_ids) {
    const badge = await badgesRepo.findById(tenantId, badgeId);
    if (!badge) {
      throw new AppError(404, `Badge ${badgeId} not found`);
    }
  }

  await badgesRepo.assignToJob(tenantId, jobId, input.badge_ids);
  return jobRepo.findById(tenantId, jobId);
}

/** Default badges to seed for a new tenant. */
export const DEFAULT_BADGES = [
  { badge_name: 'VIP', badge_color: '#7C3AED', badge_icon: 'crown', sort_order: 0 },
  { badge_name: 'Priority', badge_color: '#DC2626', badge_icon: 'alert-triangle', sort_order: 1 },
  { badge_name: 'New Customer', badge_color: '#059669', badge_icon: 'user-plus', sort_order: 2 },
  { badge_name: 'Hold', badge_color: '#D97706', badge_icon: 'pause-circle', sort_order: 3 },
  { badge_name: 'Returning', badge_color: '#2563EB', badge_icon: 'refresh-cw', sort_order: 4 },
  { badge_name: 'Referral', badge_color: '#0891B2', badge_icon: 'share-2', sort_order: 5 },
];

export async function seedDefaultBadges(tenantId: string) {
  const existing = await badgesRepo.findAll(tenantId);
  if (existing.length > 0) return existing;

  const results = [];
  for (const badge of DEFAULT_BADGES) {
    results.push(await badgesRepo.upsert(tenantId, badge));
  }
  return results;
}
