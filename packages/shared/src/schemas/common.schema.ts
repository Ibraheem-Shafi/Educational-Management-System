import { z } from 'zod';

/** Standard list pagination query params — default 8 items per page. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Query-string boolean. `z.coerce.boolean()` treats `"false"` as true
 * (Boolean("false") === true); this parses common truthy/falsy strings correctly.
 */
export const queryBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return value;
}, z.boolean().optional());
