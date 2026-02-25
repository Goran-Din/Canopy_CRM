// ============================================
// Canopy Quotes Integration Client — STUB
// ============================================

export async function getQuote(_tenantId: string, _quoteId: string): Promise<{ message: string }> {
  return { message: 'Canopy Quotes get-quote stub — not yet implemented' };
}

export async function listQuotes(_tenantId: string): Promise<{ message: string; data: unknown[] }> {
  return { message: 'Canopy Quotes list-quotes stub — not yet implemented', data: [] };
}

export async function convertQuoteToContract(_tenantId: string, _quoteId: string): Promise<{ message: string }> {
  return { message: 'Canopy Quotes convert-to-contract stub — not yet implemented' };
}
