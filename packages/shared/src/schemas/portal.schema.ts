import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const portalSectionQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    search: z.string().optional(),
    studentId: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type PortalSectionQuery = z.infer<typeof portalSectionQuerySchema>;

export const portalCalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  studentId: z.string().optional(),
});

export type PortalCalendarQuery = z.infer<typeof portalCalendarQuerySchema>;

export const createLeaveRequestSchema = z.object({
  studentId: requiredId('Student'),
  fromDate: requiredId('From date'),
  toDate: requiredId('To date'),
  reason: requiredString('Reason', 3, 500),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

/** Staff/employee leave (no studentId — requester is the authenticated user). */
export const createEmployeeLeaveRequestSchema = z.object({
  fromDate: requiredId('From date'),
  toDate: requiredId('To date'),
  reason: requiredString('Reason', 3, 500),
});

export type CreateEmployeeLeaveRequestInput = z.infer<typeof createEmployeeLeaveRequestSchema>;

export const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected'], { errorMap: () => ({ message: MSG.select('status') }) }),
  reviewNotes: optionalString(1000),
});

export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;

export const LEAVE_REQUEST_KINDS = ['student', 'employee'] as const;
export const LEAVE_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;

export const listLeaveRequestsQuerySchema = z
  .object({
    kind: z.enum(['student', 'employee']).optional(),
  })
  .merge(paginationQuerySchema);

export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
