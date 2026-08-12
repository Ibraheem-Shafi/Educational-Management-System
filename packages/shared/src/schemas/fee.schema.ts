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
    feeTypeId: z.string().optional(),
    search: z.string().optional(),
    dueFrom: z.string().optional(),
    dueTo: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeInvoicesQuery = z.infer<typeof listFeeInvoicesQuerySchema>;

export const recordPaymentSchema = z
  .object({
    amount: requiredPositiveNumber('Amount').optional(),
    method: z
      .enum(['cash', 'bank', 'online', 'other'], {
        errorMap: () => ({ message: MSG.select('payment method') }),
      })
      .optional(),
    paidAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
    providerRef: z
      .string()
      .trim()
      .max(120, MSG.maxLength('Transaction reference', 120))
      .optional(),
    receipt: z
      .object({
        storagePath: z.string().min(1),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(120).optional(),
        sizeBytes: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'bank' || data.method === 'online') {
      if (!data.receipt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MSG.required('Payment receipt'),
          path: ['receipt'],
        });
      }
    }
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
    feeTypeId: z.string().optional(),
    search: z.string().optional(),
    includeInactive: z.coerce.boolean().optional(),
    /** When true, only inactive; when false, only active; omit for all when includeInactive. */
    isActive: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeStructuresQuery = z.infer<typeof listFeeStructuresQuerySchema>;

export const bulkInvoiceLineSchema = z
  .object({
    studentId: requiredId('Student'),
    amount: z.coerce.number({ required_error: MSG.required('Amount') }),
    include: z.boolean().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.include === false) return;
    if (!(line.amount > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.positiveNumber('Amount'),
        path: ['amount'],
      });
    }
  });

export type BulkInvoiceLineInput = z.infer<typeof bulkInvoiceLineSchema>;

/**
 * Bulk invoice preview/generate scope:
 * - With `batchId`: students in that batch only
 * - Without `batchId`: all non-deleted students in the branch
 * Amounts resolve per student from FeeStructure (batch → program → branch default).
 */
export const previewBulkInvoicesSchema = z.object({
  branchId: requiredId('Branch'),
  /** Omit or leave empty for entire-branch scope. */
  batchId: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    requiredId('Batch').optional(),
  ),
  feeTypeId: requiredId('Fee type'),
  feeStructureId: requiredId('Fee structure').optional(),
  defaultAmount: requiredPositiveNumber('Default amount').optional(),
});

export type PreviewBulkInvoicesInput = z.infer<typeof previewBulkInvoicesSchema>;

export const generateBulkInvoicesSchema = z
  .object({
    branchId: requiredId('Branch'),
    /** Omit or leave empty for entire-branch scope. */
    batchId: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      requiredId('Batch').optional(),
    ),
    feeTypeId: requiredId('Fee type').optional(),
    feeStructureIds: z.array(requiredId('Fee structure')).optional(),
    dueDate: z.string().datetime({ message: MSG.invalidDate }).optional(),
    lines: z.array(bulkInvoiceLineSchema).min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.lines?.length && !data.feeTypeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.select('fee type'),
        path: ['feeTypeId'],
      });
    }
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

export const listFeeTypesQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  /** When true, only inactive; when false, only active; omit for all when includeInactive. */
  isActive: z.coerce.boolean().optional(),
});

export type ListFeeTypesQuery = z.infer<typeof listFeeTypesQuerySchema>;

export const listFeeDefaultersQuerySchema = z
  .object({
    search: z.string().optional(),
    dueFrom: z.string().optional(),
    dueTo: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeDefaultersQuery = z.infer<typeof listFeeDefaultersQuerySchema>;
