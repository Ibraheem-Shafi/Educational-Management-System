import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';
import { paginationQuerySchema } from './common.schema';

export const portalSectionQuerySchema = refineEndAfterStart(
  z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      search: z.string().optional(),
      studentId: z.string().optional(),
    })
    .merge(paginationQuerySchema),
  'from',
  'to',
  { allowEqual: true },
);

export type PortalSectionQuery = z.infer<typeof portalSectionQuerySchema>;

export const portalCalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  studentId: z.string().optional(),
});

export type PortalCalendarQuery = z.infer<typeof portalCalendarQuerySchema>;

export const createLeaveRequestSchema = refineEndAfterStart(
  z.object({
    studentId: requiredId('Student'),
    fromDate: requiredId('From date'),
    toDate: requiredId('To date'),
    reason: requiredString('Reason', 3, 2000),
  }),
  'fromDate',
  'toDate',
  { allowEqual: true },
);

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

/** Staff/employee leave (no studentId — requester is the authenticated user). */
export const createEmployeeLeaveRequestSchema = refineEndAfterStart(
  z.object({
    fromDate: requiredId('From date'),
    toDate: requiredId('To date'),
    reason: requiredString('Reason', 3, 2000),
  }),
  'fromDate',
  'toDate',
  { allowEqual: true },
);

export type CreateEmployeeLeaveRequestInput = z.infer<typeof createEmployeeLeaveRequestSchema>;

export const leaveAttachmentMetaSchema = z.object({
  fileName: requiredString('File name', 1, 255),
  storagePath: requiredString('Storage path', 1, 500),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export type LeaveAttachmentMetaInput = z.infer<typeof leaveAttachmentMetaSchema>;

export const prepareLeaveAttachmentUploadSchema = z.object({
  fileName: requiredString('File name', 1, 255),
});

export type PrepareLeaveAttachmentUploadInput = z.infer<
  typeof prepareLeaveAttachmentUploadSchema
>;

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
    status: z.enum(LEAVE_REQUEST_STATUSES).optional(),
    search: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
