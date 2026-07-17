import { z } from 'zod';

export const employmentTypes = ['full_time', 'part_time', 'contract', 'intern'] as const;
export const contractStatuses = ['active', 'ended', 'terminated'] as const;

export const createContractSchema = z.object({
  userId: z.string().min(1),
  branchId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  employmentType: z.enum(employmentTypes),
  salaryNote: z.string().max(500).optional().nullable(),
  status: z.enum(contractStatuses).optional(),
  documentPath: z.string().optional().nullable(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = createContractSchema
  .omit({ userId: true, branchId: true })
  .partial();

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const listContractsQuerySchema = z.object({
  userId: z.string().min(1),
  branchId: z.string().optional(),
});

export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

export const createReviewSchema = z.object({
  userId: z.string().min(1),
  branchId: z.string().min(1),
  periodLabel: z.string().min(1).max(100),
  reviewedAt: z.string().min(1),
  score: z.coerce.number().min(0).max(100).optional().nullable(),
  summary: z.string().min(1).max(5000),
  reviewedById: z.string().optional().nullable(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = createReviewSchema
  .omit({ userId: true, branchId: true })
  .partial();

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const listReviewsQuerySchema = z.object({
  userId: z.string().min(1),
  branchId: z.string().optional(),
});

export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
