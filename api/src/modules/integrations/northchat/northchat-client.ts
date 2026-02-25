// ============================================
// NorthChat Integration Client — STUB
// ============================================

export async function getContext(_tenantId: string): Promise<{ message: string }> {
  return { message: 'NorthChat get-context stub — not yet implemented' };
}

export async function sendNotification(_tenantId: string, _data: unknown): Promise<{ message: string }> {
  return { message: 'NorthChat send-notification stub — not yet implemented' };
}
