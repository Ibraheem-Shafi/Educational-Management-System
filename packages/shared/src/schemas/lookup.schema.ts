import { z } from 'zod';

export const createLookupStatusSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateLookupStatusSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateLookupStatusInput = z.infer<typeof createLookupStatusSchema>;
export type UpdateLookupStatusInput = z.infer<typeof updateLookupStatusSchema>;
