import { z } from 'zod';

export const inquiryStatuses = [
  'new',
  'contacted',
  'interested',
  'enrolled',
  'lost',
] as const;

export const createInquirySchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().min(2).max(200),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  programInterest: z.string().optional(),
  status: z.enum(inquiryStatuses).optional(),
  notes: z.string().optional(),
  followUpAt: z.string().datetime().optional().nullable(),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

/** Public applicant form — status fixed to new; no follow-up fields. */
export const publicInquirySchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().min(2).max(200),
  phone: z.string().min(5).max(30),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  programInterest: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export type PublicInquiryInput = z.infer<typeof publicInquirySchema>;

export const updateInquirySchema = createInquirySchema.omit({ branchId: true }).partial();

export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;

export const listInquiriesQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(inquiryStatuses).optional(),
  search: z.string().optional(),
});

export type ListInquiriesQuery = z.infer<typeof listInquiriesQuerySchema>;

export const createVisitorSchema = z.object({
  branchId: z.string().min(1),
  fullName: z.string().min(2).max(200),
  phone: z.string().optional(),
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

export const listVisitorsQuerySchema = z.object({
  branchId: z.string().optional(),
  checkedInOnly: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type ListVisitorsQuery = z.infer<typeof listVisitorsQuerySchema>;

export const complaintTypes = ['complaint', 'request'] as const;

export const complaintStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;

export const priorities = ['low', 'normal', 'high'] as const;

export const createComplaintSchema = z.object({
  branchId: z.string().min(1),
  type: z.enum(complaintTypes),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  status: z.enum(complaintStatuses).optional(),
  priority: z.enum(priorities).optional(),
  requesterName: z.string().optional(),
  requesterPhone: z.string().optional(),
  assignedToId: z.string().optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const updateComplaintSchema = createComplaintSchema.omit({ branchId: true }).partial();

export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;

export const listComplaintsQuerySchema = z.object({
  branchId: z.string().optional(),
  type: z.enum(complaintTypes).optional(),
  status: z.enum(complaintStatuses).optional(),
  priority: z.enum(priorities).optional(),
  search: z.string().optional(),
});

export type ListComplaintsQuery = z.infer<typeof listComplaintsQuerySchema>;

export const createActivityNoteSchema = z.object({
  branchId: z.string().min(1),
  summary: z.string().min(1).max(500),
});

export type CreateActivityNoteInput = z.infer<typeof createActivityNoteSchema>;

export const listActivitiesQuerySchema = z.object({
  branchId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

export const convertInquirySchema = z.object({
  studentId: z.string().min(1),
  notes: z.string().optional(),
});

export type ConvertInquiryInput = z.infer<typeof convertInquirySchema>;
