import { z } from 'zod';
import {
  MSG,
  optionalEmail,
  optionalPhone,
  optionalString,
  requiredId,
  requiredPhone,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const inquiryStatuses = [
  'new',
  'contacted',
  'interested',
  'enrolled',
  'lost',
] as const;

export const createInquirySchema = z.object({
  branchId: requiredId('Branch'),
  fullName: requiredString('Full name'),
  phone: optionalPhone(),
  email: optionalEmail(),
  programInterest: z.string().optional(),
  status: z.enum(inquiryStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  notes: z.string().optional(),
  followUpAt: z.string().datetime({ message: MSG.invalidDate }).optional().nullable(),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

/** Public applicant form — status fixed to new; no follow-up fields. */
export const publicInquirySchema = z.object({
  branchId: requiredId('Branch'),
  fullName: requiredString('Full name'),
  phone: requiredPhone(),
  email: z.union([z.string().email(MSG.email), z.literal('')]).optional(),
  programInterest: optionalString(200),
  notes: optionalString(1000),
});

export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

export const updateInquirySchema = createInquirySchema.omit({ branchId: true }).partial();

export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;

export const listInquiriesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    status: z.enum(inquiryStatuses).optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListInquiriesQuery = z.infer<typeof listInquiriesQuerySchema>;

export const createVisitorSchema = z.object({
  branchId: requiredId('Branch'),
  fullName: requiredString('Full name'),
  phone: optionalPhone(),
  purpose: z.string().optional(),
  hostName: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;

export const updateVisitorSchema = createVisitorSchema
  .omit({ branchId: true })
  .partial()
  .extend({
    checkOut: z.boolean().optional(),
  });

export type UpdateVisitorInput = z.infer<typeof updateVisitorSchema>;

export const listVisitorsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    checkedInOnly: z.coerce.boolean().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListVisitorsQuery = z.infer<typeof listVisitorsQuerySchema>;

export const complaintTypes = ['complaint', 'request'] as const;

export const complaintStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;

export const priorities = ['low', 'normal', 'high'] as const;

export const createComplaintSchema = z.object({
  branchId: requiredId('Branch'),
  type: z.enum(complaintTypes, { errorMap: () => ({ message: MSG.select('type') }) }),
  subject: requiredString('Subject', 1, 200),
  body: requiredString('Body', 1, 5000),
  status: z.enum(complaintStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  priority: z.enum(priorities, { errorMap: () => ({ message: MSG.select('priority') }) }).optional(),
  requesterName: z.string().optional(),
  requesterPhone: optionalPhone(),
  assignedToId: z.string().optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const updateComplaintSchema = createComplaintSchema.omit({ branchId: true }).partial();

export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;

export const listComplaintsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    type: z.enum(complaintTypes).optional(),
    status: z.enum(complaintStatuses).optional(),
    priority: z.enum(priorities).optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListComplaintsQuery = z.infer<typeof listComplaintsQuerySchema>;

export const createActivityNoteSchema = z.object({
  branchId: requiredId('Branch'),
  summary: requiredString('Summary', 1, 500),
});

export type CreateActivityNoteInput = z.infer<typeof createActivityNoteSchema>;

export const listActivitiesQuerySchema = z.object({
  branchId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

export const convertInquirySchema = z.object({
  studentId: requiredId('Student'),
  notes: z.string().optional(),
});

export type ConvertInquiryInput = z.infer<typeof convertInquirySchema>;
