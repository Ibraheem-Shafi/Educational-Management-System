import { z } from 'zod';

export const createFeeInvoiceSchema = z.object({
  branchId: z.string().min(1),
  studentId: z.string().min(1),
  feeTypeId: z.string().min(1),
  amount: z.coerce.number().positive(),
  discount: z.coerce.number().min(0).optional(),
  fine: z.coerce.number().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

export type CreateFeeInvoiceInput = z.infer<typeof createFeeInvoiceSchema>;

export const listFeeInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().optional(),
  studentId: z.string().optional(),
  statusId: z.string().optional(),
});

export type ListFeeInvoicesQuery = z.infer<typeof listFeeInvoicesQuerySchema>;

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  method: z.enum(['cash', 'bank', 'online', 'other']).optional(),
  paidAt: z.string().datetime().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const createFeeStructureSchema = z.object({
  branchId: z.string().min(1),
  feeTypeId: z.string().min(1),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  amount: z.coerce.number().positive(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;

export const updateFeeStructureSchema = createFeeStructureSchema
  .omit({ branchId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;

export const listFeeStructuresQuerySchema = z.object({
  branchId: z.string().optional(),
  batchId: z.string().optional(),
  programId: z.string().optional(),
});

export type ListFeeStructuresQuery = z.infer<typeof listFeeStructuresQuerySchema>;

export const generateBulkInvoicesSchema = z.object({
  branchId: z.string().min(1),
  batchId: z.string().min(1),
  feeStructureIds: z.array(z.string().min(1)).optional(),
  dueDate: z.string().datetime().optional(),
});

export type GenerateBulkInvoicesInput = z.infer<typeof generateBulkInvoicesSchema>;

export const createFeeTypeSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
});

export type CreateFeeTypeInput = z.infer<typeof createFeeTypeSchema>;

export const updateFeeTypeSchema = createFeeTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateFeeTypeInput = z.infer<typeof updateFeeTypeSchema>;
