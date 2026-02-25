// ============================================
// Mautic Integration Client — STUB
// ============================================

import * as repo from '../repository.js';

export async function pushLead(tenantId: string, prospectId: string): Promise<{ message: string }> {
  const log = await repo.createSyncLog(tenantId, 'mautic', 'push', 'lead', prospectId);
  await repo.updateSyncLog(log.id, 'skipped', null, 'Mautic integration not yet implemented');
  return { message: 'Mautic push-lead stub — not yet implemented' };
}

export async function pullLeads(tenantId: string): Promise<{ message: string }> {
  return { message: 'Mautic pull-leads stub — not yet implemented' };
}
