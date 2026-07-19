import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredPositiveNumber,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const createFeeInvoiceSchema = z.object({
  branchId: requiredId('Branch'),
  studentId: requiredId('Student'),
  feeTypeId: requiredId('Fee type'),
  amount: requiredPositiveNumber('Amount'),
  discount: z.coerce.number().min(0).optional(),
  fine: z.coerce.number().min(0).optional(),
  dueDate: z.string().datetime({ message: MSG.invalidDate }).optional(),
  remarks: optionalString(500),
});

export type CreateFeeInvoiceInput = z.infer<typeof createFeeInvoiceSchema>;

export const listFeeInvoicesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    studentId: z.string().optional(),
    statusId: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeInvoicesQuery = z.infer<typeof listFeeInvoicesQuerySchema>;

export const recordPaymentSchema = z.object({
  amount: requiredPositiveNumber('Amount').optional(),
  method: z.enum(['cash', 'bank', 'online', 'other'], {
    errorMap: () => ({ message: MSG.select('payment method') }),
  }).optional(),
  paidAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const createFeeStructureSchema = z.object({
  branchId: requiredId('Branch'),
  feeTypeId: requiredId('Fee type'),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  amount: requiredPositiveNumber('Amount'),
  dueDayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;

export const updateFeeStructureSchema = createFeeStructureSchema
  .omit({ branchId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;

export const listFeeStructuresQuerySchema = z
  .object({
    branchId: z.string().optional(),
    batchId: z.string().optional(),
    programId: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeStructuresQuery = z.infer<typeof listFeeStructuresQuerySchema>;

export const generateBulkInvoicesSchema = z.object({
  branchId: requiredId('Branch'),
  batchId: requiredId('Batch'),
  feeStructureIds: z.array(requiredId('Fee structure')).optional(),
  dueDate: z.string().datetime({ message: MSG.invalidDate }).optional(),
});

export type GenerateBulkInvoicesInput = z.infer<typeof generateBulkInvoicesSchema>;

export const createFeeTypeSchema = z.object({
  name: requiredString('Name', 2, 100),
  code: requiredString('Code', 1, 50),
  description: optionalString(500),
});

export type CreateFeeTypeInput = z.infer<typeof createFeeTypeSchema>;

export const updateFeeTypeSchema = createFeeTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateFeeTypeInput = z.infer<typeof updateFeeTypeSchema>;
