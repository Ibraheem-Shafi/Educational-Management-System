import { z } from 'zod';
import { refineEndAfterStart } from '../validation/date-range';

export const listAuditLogsQuerySchema = refineEndAfterStart(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(8),
    userId: z.string().optional(),
    entityType: z.string().optional(),
    action: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
  'from',
  'to',
  { allowEqual: true },
);

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
