import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';
import { paginationQuerySchema } from './common.schema';

export const salaryComponentKinds = [
  'allowance',
  'deduction',
  'tax',
  'eobi',
  'provident_fund',
] as const;
export const payrollRunStatuses = [
  'draft',
  'pending_approval',
  'approved',
  'finalized',
] as const;
export const payrollPaymentMethods = ['cash', 'bank'] as const;
export type SalaryComponentKind = (typeof salaryComponentKinds)[number];
export type PayrollPaymentMethod = (typeof payrollPaymentMethods)[number];

export const STATUTORY_COMPONENT_KINDS = ['tax', 'eobi', 'provident_fund'] as const;

export const salaryComponentSchema = z.object({
  kind: z.enum(salaryComponentKinds, { errorMap: () => ({ message: MSG.select('component kind') }) }),
  name: requiredString('Name', 1, 100),
  amount: z.coerce.number().min(0),
  percentOfBasic: z.coerce.number().min(0).max(100).optional().nullable(),
});

export type SalaryComponentInput = z.infer<typeof salaryComponentSchema>;

const createSalaryStructureFieldsSchema = z.object({
  userId: requiredId('User'),
  branchId: requiredId('Branch'),
  basicSalary: z.coerce.number().min(0),
  effectiveFrom: requiredId('Effective from'),
  effectiveTo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  components: z.array(salaryComponentSchema).default([]),
});

export const createSalaryStructureSchema = refineEndAfterStart(
  createSalaryStructureFieldsSchema,
  'effectiveFrom',
  'effectiveTo',
);

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;

export const updateSalaryStructureSchema = refineEndAfterStart(
  createSalaryStructureFieldsSchema.omit({ userId: true, branchId: true }).partial(),
  'effectiveFrom',
  'effectiveTo',
);

export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;

export const listSalaryStructuresQuerySchema = z
  .object({
    branchId: z.string().optional(),
    userId: z.string().optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListSalaryStructuresQuery = z.infer<typeof listSalaryStructuresQuerySchema>;

export const createPayrollRunSchema = z.object({
  branchId: requiredId('Branch'),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  notes: optionalString(2000).nullable(),
});

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const adjustPayrollLineSchema = z.object({
  adjustmentsTotal: z.coerce.number(),
  reason: optionalString(500).nullable(),
});

export type AdjustPayrollLineInput = z.infer<typeof adjustPayrollLineSchema>;

export const listPayrollRunsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    status: z.enum(payrollRunStatuses).optional(),
    excludeFinalized: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  })
  .merge(paginationQuerySchema);

export type ListPayrollRunsQuery = z.infer<typeof listPayrollRunsQuerySchema>;

export const markPayrollPaidSchema = z.object({
  paymentMethod: z.enum(payrollPaymentMethods, {
    errorMap: () => ({ message: MSG.select('payment method') }),
  }),
});

export type MarkPayrollPaidInput = z.infer<typeof markPayrollPaidSchema>;

export const exportPayrollRunQuerySchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
});

export type ExportPayrollRunQuery = z.infer<typeof exportPayrollRunQuerySchema>;
