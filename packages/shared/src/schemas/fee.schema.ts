import { z } from 'zod';
import {
  MSG,
  billingPeriodSchema,
  calendarDateSchema,
  optionalString,
  requiredId,
  requiredPositiveNumber,
  requiredString,
} from '../validation/messages';

export const annualChargeModes = ['full', 'installments', 'waived', 'deferred'] as const;
export type AnnualChargeMode = (typeof annualChargeModes)[number];

export const feeIncrementScopes = [
  'all_campuses',
  'branch',
  'program',
  'batch',
  'student',
] as const;
export type FeeIncrementScope = (typeof feeIncrementScopes)[number];
import { paginationQuerySchema } from './common.schema';

export const feeInvoiceLineSchema = z.object({
  feeTypeId: requiredId('Fee type'),
  label: optionalString(120),
  amount: requiredPositiveNumber('Amount'),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export type FeeInvoiceLineInput = z.infer<typeof feeInvoiceLineSchema>;

export const createFeeInvoiceSchema = z
  .object({
    branchId: requiredId('Branch'),
    studentId: requiredId('Student'),
    feeTypeId: requiredId('Fee type').optional(),
    amount: requiredPositiveNumber('Amount').optional(),
    discount: z.coerce.number().min(0).optional(),
    fine: z.coerce.number().min(0).optional(),
    dueDate: z.string().datetime({ message: MSG.invalidDate }).optional(),
    remarks: optionalString(500),
    billingPeriod: billingPeriodSchema.optional(),
    voucherNo: optionalString(120),
    lines: z.array(feeInvoiceLineSchema).min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.lines?.length) return;
    if (!data.feeTypeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.select('fee type'),
        path: ['feeTypeId'],
      });
    }
    if (data.amount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.required('Amount'),
        path: ['amount'],
      });
    }
  });

export type CreateFeeInvoiceInput = z.infer<typeof createFeeInvoiceSchema>;

export const updateFeeInvoiceSchema = z.object({
  amount: requiredPositiveNumber('Amount').optional(),
  discount: z.coerce.number().min(0).optional(),
  fine: z.coerce.number().min(0).optional(),
  dueDate: z.string().datetime({ message: MSG.invalidDate }).nullable().optional(),
  remarks: optionalString(500),
  billingPeriod: billingPeriodSchema.nullable().optional(),
  voucherNo: optionalString(120),
  lines: z.array(feeInvoiceLineSchema).min(1).optional(),
});

export type UpdateFeeInvoiceInput = z.infer<typeof updateFeeInvoiceSchema>;

export const bulkFeeInvoicePrintQuerySchema = z.object({
  ids: z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(','))
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(requiredId('Invoice')).min(1).max(120)),
});
export type BulkFeeInvoicePrintQuery = z.infer<typeof bulkFeeInvoicePrintQuerySchema>;

export const bulkFeeInvoicePrintBodySchema = z.object({
  ids: z.array(requiredId('Invoice')).min(1).max(800),
});
export type BulkFeeInvoicePrintBody = z.infer<typeof bulkFeeInvoicePrintBodySchema>;

export const listFeeInvoicesQuerySchema = z
  .object({
    branchId: z.string().optional(),
    studentId: z.string().optional(),
    statusId: z.string().optional(),
    feeTypeId: z.string().optional(),
    billingPeriod: z.string().optional(),
    search: z.string().optional(),
    dueFrom: z.string().optional(),
    dueTo: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeInvoicesQuery = z.infer<typeof listFeeInvoicesQuerySchema>;

/** Paginate by student; each row includes a latest-2 invoice preview. */
export const listFeeInvoicesByStudentQuerySchema = listFeeInvoicesQuerySchema.omit({
  studentId: true,
});

export type ListFeeInvoicesByStudentQuery = z.infer<typeof listFeeInvoicesByStudentQuerySchema>;

export const recordPaymentSchema = z
  .object({
    amount: requiredPositiveNumber('Amount').optional(),
    method: z
      .enum(['cash', 'bank', 'online', 'other', 'cheque'], {
        errorMap: () => ({ message: MSG.select('payment method') }),
      })
      .optional(),
    paidAt: calendarDateSchema.optional(),
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
    if (data.method === 'cheque' && !data.providerRef?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.required('Cheque number'),
        path: ['providerRef'],
      });
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
  feeTypeId: requiredId('Fee type').optional(),
  feeTypeIds: z.array(requiredId('Fee type')).min(1).optional(),
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
    feeTypeIds: z.array(requiredId('Fee type')).min(1).optional(),
    feeStructureIds: z.array(requiredId('Fee structure')).optional(),
    dueDate: z.string().datetime({ message: MSG.invalidDate }).optional(),
    billingPeriod: billingPeriodSchema.optional(),
    lines: z.array(bulkInvoiceLineSchema).min(1).optional(),
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

/** Filters for defaulters summary charts (no pagination). */
export const feeDefaultersSummaryQuerySchema = z.object({
  search: z.string().optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
});

export type FeeDefaultersSummaryQuery = z.infer<typeof feeDefaultersSummaryQuerySchema>;

export const FEE_CHALLAN_LINE_CODES = [
  'monthly',
  'arrears',
  'admission',
  'registration',
  'annual',
  'party',
  'security',
] as const;

export type FeeChallanLineCode = (typeof FEE_CHALLAN_LINE_CODES)[number];

export const listFeeChallansQuerySchema = z
  .object({
    branchId: z.string().optional(),
    studentId: z.string().optional(),
    billingPeriod: z.string().optional(),
    status: z.enum(['unpaid', 'partial', 'paid']).optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListFeeChallansQuery = z.infer<typeof listFeeChallansQuerySchema>;

export const feeChallanLineInputSchema = z.object({
  code: z.enum(FEE_CHALLAN_LINE_CODES),
  label: requiredString('Label', 1, 120),
  amount: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().optional(),
  feeInvoiceId: z.string().optional(),
});

export const createFeeChallanSchema = z.object({
  branchId: requiredId('Branch'),
  studentId: requiredId('Student'),
  billingPeriod: billingPeriodSchema,
  challanNo: optionalString(80),
  dueDate: z.string().datetime({ message: MSG.invalidDate }).optional(),
  sessionLabel: optionalString(40),
  lines: z.array(feeChallanLineInputSchema).min(1),
});

export type CreateFeeChallanInput = z.infer<typeof createFeeChallanSchema>;

/** Past challans: lines/due/session only — student and billing period are immutable. */
export const updateFeeChallanSchema = z.object({
  dueDate: z.string().datetime({ message: MSG.invalidDate }).nullable().optional(),
  sessionLabel: optionalString(40),
  lines: z.array(feeChallanLineInputSchema).min(1).optional(),
});

export type UpdateFeeChallanInput = z.infer<typeof updateFeeChallanSchema>;

export const incrementFeeRatesSchema = z
  .object({
    dryRun: z.boolean().optional(),
    scope: z.enum(feeIncrementScopes),
    branchId: z.string().optional(),
    programId: z.string().optional(),
    batchId: z.string().optional(),
    studentId: z.string().optional(),
    feeTypeId: requiredId('Fee type'),
    mode: z.enum(['percent', 'amount']),
    value: z.coerce.number().positive(MSG.positiveNumber('Increment')),
    effectiveFrom: billingPeriodSchema,
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'branch' && !data.branchId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.required('Branch'), path: ['branchId'] });
    }
    if (data.scope === 'program' && !data.programId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.required('Program'), path: ['programId'] });
    }
    if (data.scope === 'batch' && !data.batchId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.required('Batch'), path: ['batchId'] });
    }
    if (data.scope === 'student' && !data.studentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG.required('Student'), path: ['studentId'] });
    }
  });

export type IncrementFeeRatesInput = z.infer<typeof incrementFeeRatesSchema>;

export const updateStudentFeePolicySchema = z
  .object({
    monthlyFeeDiscount: z.coerce.number().min(0).optional(),
    monthlyFeeAmount: z.coerce.number().min(0).nullable().optional(),
    monthlyFeeWaived: z.boolean().optional(),
    annualChargeMode: z.enum(annualChargeModes).optional(),
    annualDeferredUntil: calendarDateSchema.nullable().optional(),
    annualInstallmentCount: z.coerce.number().int().min(1).max(24).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.annualChargeMode === 'deferred' && !data.annualDeferredUntil) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.required('Defer until date'),
        path: ['annualDeferredUntil'],
      });
    }
  });

export type UpdateStudentFeePolicyInput = z.infer<typeof updateStudentFeePolicySchema>;
