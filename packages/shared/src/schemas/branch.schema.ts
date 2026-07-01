import { z } from 'zod';
import { PHONE_REGEX } from '../constants/pakistan';

export const createBranchSchema = z.object({
  name: z.string().min(2).max(200),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-z0-9_-]+$/i, 'Code must be alphanumeric'),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().regex(PHONE_REGEX).optional(),
  email: z.string().email().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
