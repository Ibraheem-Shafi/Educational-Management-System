import { z } from 'zod';

export const NOTICE_AUDIENCES = ['all', 'parents', 'students', 'staff', 'teachers'] as const;

export const createNoticeSchema = z.object({
  branchId: z.string().min(1),
  title: z.string().min(2).max(200),
  body: z.string().min(1).max(10000),
  audience: z.enum(NOTICE_AUDIENCES),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const updateNoticeSchema = createNoticeSchema
  .omit({ branchId: true })
  .partial()
  .extend({ isPublished: z.boolean().optional() });

export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;

export const listNoticesQuerySchema = z.object({
  branchId: z.string().optional(),
  audience: z.enum(NOTICE_AUDIENCES).optional(),
  publishedOnly: z.coerce.boolean().optional(),
});

export type ListNoticesQuery = z.infer<typeof listNoticesQuerySchema>;
