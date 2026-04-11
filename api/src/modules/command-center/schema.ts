import { z } from 'zod';

// No request params needed — endpoint returns current state
export const commandCenterSummarySchema = z.object({}).optional();
