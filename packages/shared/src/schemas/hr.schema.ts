import { z } from 'zod';
import {
  MSG,
  optionalEmail,
  optionalPhone,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';
import { paginationQuerySchema } from './common.schema';

export const employmentTypes = ['full_time', 'part_time', 'contract', 'intern'] as const;
export const contractStatuses = ['active', 'ended', 'terminated'] as const;

const createContractFieldsSchema = z.object({
  userId: requiredId('User'),
  branchId: requiredId('Branch'),
  startDate: requiredId('Start date'),
  endDate: z.string().optional().nullable(),
  employmentType: z.enum(employmentTypes, { errorMap: () => ({ message: MSG.select('employment type') }) }),
  salaryNote: optionalString(500).nullable(),
  status: z.enum(contractStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  documentPath: z.string().optional().nullable(),
});

export const createContractSchema = refineEndAfterStart(
  createContractFieldsSchema,
  'startDate',
  'endDate',
);

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = refineEndAfterStart(
  createContractFieldsSchema.omit({ userId: true, branchId: true }).partial(),
  'startDate',
  'endDate',
);

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const applicantStages = ['applied', 'interview', 'offer', 'hired', 'rejected'] as const;

export const listContractsQuerySchema = z
  .object({
    userId: z.string().optional(),
    branchId: z.string().optional(),
    status: z.enum(contractStatuses).optional(),
  })
  .merge(paginationQuerySchema);

export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

export const createReviewSchema = z.object({
  userId: requiredId('User'),
  branchId: requiredId('Branch'),
  periodLabel: requiredString('Period label', 1, 100),
  reviewedAt: requiredId('Review date'),
  score: z.coerce.number().min(0).max(100).optional().nullable(),
  summary: requiredString('Summary', 1, 5000),
  reviewedById: z.string().optional().nullable(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = createReviewSchema
  .omit({ userId: true, branchId: true })
  .partial();

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const listReviewsQuerySchema = z
  .object({
    userId: z.string().min(1),
    branchId: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;

export const createApplicantSchema = z.object({
  branchId: requiredId('Branch'),
  fullName: requiredString('Full name'),
  email: optionalEmail(),
  phone: optionalPhone(),
  roleApplied: requiredString('Role applied', 1, 100),
  stage: z.enum(applicantStages, { errorMap: () => ({ message: MSG.select('stage') }) }).optional(),
  appliedAt: requiredId('Applied date'),
  hiredUserId: z.string().optional().nullable(),
  notes: optionalString(2000).nullable(),
});
export type CreateApplicantInput = z.infer<typeof createApplicantSchema>;
export const updateApplicantSchema = createApplicantSchema.omit({ branchId: true }).partial();
export type UpdateApplicantInput = z.infer<typeof updateApplicantSchema>;
export const listApplicantsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    search: z.string().optional(),
    stage: z.enum(applicantStages).optional(),
  })
  .merge(paginationQuerySchema);
export type ListApplicantsQuery = z.infer<typeof listApplicantsQuerySchema>;
