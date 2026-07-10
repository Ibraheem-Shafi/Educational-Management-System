import { z } from 'zod';

export const portalSectionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  studentId: z.string().optional(),
});

export type PortalSectionQuery = z.infer<typeof portalSectionQuerySchema>;

export const portalCalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  studentId: z.string().optional(),
});

export type PortalCalendarQuery = z.infer<typeof portalCalendarQuerySchema>;

export const createLeaveRequestSchema = z.object({
  studentId: z.string().min(1),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const LEAVE_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
