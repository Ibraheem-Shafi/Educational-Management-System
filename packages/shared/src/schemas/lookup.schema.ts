import { z } from 'zod';
import {
  requiredString,
} from '../validation/messages';

export const createLookupStatusSchema = z.object({
  code: requiredString('Code', 1, 64),
  label: requiredString('Label', 1, 128),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateLookupStatusSchema = z.object({
  label: requiredString('Label', 1, 128).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateLookupStatusInput = z.infer<typeof createLookupStatusSchema>;
export type UpdateLookupStatusInput = z.infer<typeof updateLookupStatusSchema>;
