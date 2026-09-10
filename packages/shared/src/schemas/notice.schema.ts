import { z } from 'zod';
import {
  MSG,
  requiredId,
  requiredString,
} from '../validation/messages';

export const NOTICE_AUDIENCES = ['all', 'parents', 'students', 'staff', 'teachers'] as const;

export const createNoticeSchema = z.object({
  branchId: requiredId('Branch'),
  title: requiredString('Title'),
  body: requiredString('Body', 1, 10000),
  audience: z.enum(NOTICE_AUDIENCES, { errorMap: () => ({ message: MSG.select('audience') }) }),
  /** Future ISO datetime to schedule publish; omit/null for a plain draft. */
  publishedAt: z.string().datetime({ message: MSG.invalidDate }).optional().nullable(),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const updateNoticeSchema = createNoticeSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    isPublished: z.boolean().optional(),
    /** When publishing, queue WhatsApp/SMS alerts (default true). */
    notifyFamilies: z.boolean().optional(),
  });

export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;

export const listNoticesQuerySchema = z.object({
  branchId: z.string().optional(),
  audience: z.enum(NOTICE_AUDIENCES).optional(),
  publishedOnly: z.coerce.boolean().optional(),
  search: z.string().optional(),
  status: z.enum(['published', 'draft', 'scheduled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
});

export type ListNoticesQuery = z.infer<typeof listNoticesQuerySchema>;
