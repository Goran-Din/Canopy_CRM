# Wave 0, Task 1: Fix $NaN on Dashboard Revenue Cards

> **Priority:** HIGH — Must be fixed before V2 builds on top of the dashboard.
> **Branch:** `fix/dashboard-nan-revenue`

---

## Problem

The Owner Dashboard and Division Manager Dashboard revenue cards are showing `$NaN` instead of dollar amounts. This happens when the API returns `null` or `undefined` for amount fields, and `parseFloat()` converts them to `NaN`.

## Root Cause Analysis

Three issues contribute to this bug:

### Issue 1: formatCurrency receives null values
The `formatCurrency()` function in both dashboards calls `parseFloat()` on the value, but if the API returns `null` for any amount field, `parseFloat(null)` returns `NaN`.

### Issue 2: Division dashboard passes division_id but backend ignores it
`DivisionDashboard.tsx` (line 92) sends `?division_id=xxx` query parameter, but the invoicing controller's `getStats()` function (line 131-138 in `api/src/modules/invoicing/controller.ts`) does NOT read or forward query parameters. The service and repository also don't accept a division filter.

### Issue 3: Amount values returned as strings
The repository returns amounts as SQL text strings (`::text`). If the sum is truly empty (no matching rows), the `COALESCE` should handle it, but edge cases with division filtering could return `null`.

## Files to Fix

### Frontend (2 files)

**1. `frontend/src/pages/OwnerDashboard.tsx`**
- Find the `formatCurrency` function (around line 88-96)
- Add null/undefined safety BEFORE the parseFloat call:
```typescript
const formatCurrency = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '$0.00';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(num);
};
```

**2. `frontend/src/pages/DivisionDashboard.tsx`**
- Apply the exact same fix to its `formatCurrency` function (around line 43-51)

### Backend (3 files)

**3. `api/src/modules/invoicing/controller.ts`**
- In the `getStats` function (around line 131-138), read optional `division_id` from query params:
```typescript
export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const divisionId = req.query.division_id as string | undefined;
    const stats = await invoiceService.getInvoiceStats(req.tenantId!, divisionId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}
```

**4. `api/src/modules/invoicing/service.ts`**
- Update the `getInvoiceStats` method (around line 434-436) to accept and pass the optional divisionId parameter:
```typescript
async getInvoiceStats(tenantId: string, divisionId?: string) {
  return invoiceRepository.getStats(tenantId, divisionId);
}
```

**5. `api/src/modules/invoicing/repository.ts`**
- Update the `getStats` method (around line 560-621) to accept optional divisionId and add a WHERE clause:
```typescript
async getStats(tenantId: string, divisionId?: string) {
  let query = `
    SELECT
      COALESCE(SUM(total), 0)::text AS total_amount,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE total - balance_due END), 0)::text AS paid_amount,
      COALESCE(SUM(CASE WHEN status IN ('sent', 'viewed', 'overdue', 'partially_paid') THEN balance_due ELSE 0 END), 0)::text AS outstanding_amount,
      COALESCE(SUM(CASE WHEN status = 'overdue' THEN balance_due ELSE 0 END), 0)::text AS overdue_amount
    FROM invoices
    WHERE tenant_id = $1 AND deleted_at IS NULL
  `;
  const params: any[] = [tenantId];

  if (divisionId) {
    query += ` AND division = $2`;
    params.push(divisionId);
  }

  const result = await pool.query(query, params);
  return result.rows[0];
}
```

## Testing

After making changes, run:
```bash
npm run test -w api
npm run typecheck
```

All existing tests must still pass. The dashboard should now show `$0.00` instead of `$NaN` when there's no data, and should correctly filter by division for division managers.

## Done When
- [ ] No `$NaN` visible on any dashboard card
- [ ] Owner Dashboard shows all invoices across all divisions
- [ ] Division Manager Dashboard shows only their division's invoices
- [ ] All existing tests pass
- [ ] Changes committed to `fix/dashboard-nan-revenue` branch
