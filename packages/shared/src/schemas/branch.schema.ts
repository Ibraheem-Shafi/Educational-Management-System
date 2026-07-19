import { z } from 'zod';
import {
  optionalEmail,
  optionalPhone,
  optionalString,
  requiredString,
} from '../validation/messages';

export const createBranchSchema = z.object({
  name: requiredString('Branch name'),
  code: requiredString('Code', 2, 20).regex(/^[a-z0-9_-]+$/i, 'Code must be alphanumeric'),
  address: optionalString(500),
  city: optionalString(100),
  phone: optionalPhone(),
  email: optionalEmail(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(8),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
