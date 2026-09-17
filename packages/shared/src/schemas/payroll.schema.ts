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
export const staffGroups = ['permanent', 'admin', 'visiting'] as const;
export const payrollRunStatuses = ['open', 'paid'] as const;
export const payrollPaymentMethods = ['cash', 'bank', 'cheque'] as const;
export type SalaryComponentKind = (typeof salaryComponentKinds)[number];
export type StaffGroup = (typeof staffGroups)[number];
export type PayrollRunStatus = (typeof payrollRunStatuses)[number];
export type PayrollPaymentMethod = (typeof payrollPaymentMethods)[number];

export const STATUTORY_COMPONENT_KINDS = ['tax', 'eobi', 'provident_fund'] as const;
export const PAYROLL_WORKING_DAYS = 30;
export const DEFAULT_EXTRA_LEC_RATE = 150;

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
  staffGroup: z.enum(staffGroups).optional(),
  bankAccount: optionalString(50).nullable(),
  eobi: z.coerce.number().min(0).optional(),
  pessi: z.coerce.number().min(0).optional(),
  extraLecRate: z.coerce.number().min(0).optional(),
  ratePerClass: z.coerce.number().min(0).optional(),
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
export const openPayrollMonthSchema = createPayrollRunSchema;
export type OpenPayrollMonthInput = CreatePayrollRunInput;

export const updatePayrollLineSchema = z.object({
  staffGroup: z.enum(staffGroups).optional(),
  designation: optionalString(120).nullable(),
  accountNumber: optionalString(50).nullable(),
  basicSalary: z.coerce.number().min(0).optional(),
  absents: z.coerce.number().int().min(0).optional(),
  extraLectures: z.coerce.number().int().min(0).optional(),
  lectureCount: z.coerce.number().int().min(0).optional(),
  ratePerClass: z.coerce.number().min(0).optional(),
  extraLecRate: z.coerce.number().min(0).optional(),
  otherAllowance: z.coerce.number().min(0).optional(),
  advanceDeduction: z.coerce.number().min(0).optional(),
  securityDeduct: z.coerce.number().min(0).optional(),
  eobi: z.coerce.number().min(0).optional(),
  pessi: z.coerce.number().min(0).optional(),
  previousAdvance: z.coerce.number().min(0).optional(),
  currentAdvance: z.coerce.number().min(0).optional(),
  securityPrevious: z.coerce.number().min(0).optional(),
  remarks: optionalString(2000).nullable(),
  paymentDate: z.string().optional().nullable(),
  amountIssued: z.coerce.number().min(0).optional(),
  paymentType: optionalString(50).nullable(),
});

export type UpdatePayrollLineInput = z.infer<typeof updatePayrollLineSchema>;

export const bulkSavePayrollLinesSchema = z.object({
  lines: z
    .array(updatePayrollLineSchema.extend({ id: requiredId('Line') }))
    .min(1)
    .max(500),
});

export type BulkSavePayrollLinesInput = z.infer<typeof bulkSavePayrollLinesSchema>;

/** @deprecated Use updatePayrollLineSchema. Kept so older clients still validate. */
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
    status: z.enum(['open', 'paid', 'draft', 'pending_approval', 'approved', 'finalized']).optional(),
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

export function roundPayrollMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function inferStaffGroup(designation?: string | null): StaffGroup {
  const value = (designation ?? '').toLowerCase();
  if (/\bvisiting\b/.test(value)) return 'visiting';
  if (
    /\b(admin|administrator|accountant|accounts|clerk|receptionist|office|a\.?o\.?|secretary|store keeper|peon)\b/.test(
      value,
    )
  ) {
    return 'admin';
  }
  return 'permanent';
}

export interface SalarySheetComputeInput {
  staffGroup: StaffGroup | string;
  basicSalary: number;
  absents: number;
  extraLectures: number;
  extraLecRate: number;
  lectureCount: number;
  ratePerClass: number;
  otherAllowance: number;
  advanceDeduction: number;
  securityDeduct: number;
  eobi: number;
  pessi: number;
  previousAdvance: number;
  currentAdvance: number;
  securityPrevious: number;
}

export interface SalarySheetComputed {
  workingDays: number;
  perDay: number;
  deductedDays: number;
  extraLecAmount: number;
  lecturesAmount: number;
  entitlementsTotal: number;
  allowancesTotal: number;
  absentFine: number;
  deductionsTotal: number;
  netPay: number;
  pendingAdvance: number;
  securityTillDate: number;
}

export function computeSalarySheetLine(input: SalarySheetComputeInput): SalarySheetComputed {
  const staffGroup = staffGroups.includes(input.staffGroup as StaffGroup)
    ? (input.staffGroup as StaffGroup)
    : 'permanent';
  const basicSalary = roundPayrollMoney(input.basicSalary);
  const workingDays = PAYROLL_WORKING_DAYS;
  const perDayRaw = workingDays > 0 ? basicSalary / workingDays : 0;
  const perDay = roundPayrollMoney(perDayRaw);
  const absents = Math.max(0, Math.trunc(input.absents || 0));
  const deductedDays = absents === 0 ? 0 : Math.max(absents - 1, 0);
  const extraLecRate = roundPayrollMoney(input.extraLecRate || DEFAULT_EXTRA_LEC_RATE);
  const extraLectures = Math.max(0, Math.trunc(input.extraLectures || 0));
  const lectureCount = Math.max(0, Math.trunc(input.lectureCount || 0));
  const ratePerClass = roundPayrollMoney(input.ratePerClass);
  const extraLecAmount =
    staffGroup === 'visiting' ? 0 : roundPayrollMoney(extraLectures * extraLecRate);
  const lecturesAmount =
    staffGroup === 'visiting' ? roundPayrollMoney(lectureCount * ratePerClass) : 0;
  const otherAllowance = roundPayrollMoney(input.otherAllowance);
  const entitlementsTotal = roundPayrollMoney(extraLecAmount + lecturesAmount + otherAllowance);
  const absentFine = roundPayrollMoney(deductedDays * perDayRaw);
  const advanceDeduction = roundPayrollMoney(input.advanceDeduction);
  const securityDeduct = roundPayrollMoney(input.securityDeduct);
  const eobi = roundPayrollMoney(input.eobi);
  const pessi = roundPayrollMoney(input.pessi);
  const deductionsTotal = roundPayrollMoney(
    absentFine + advanceDeduction + securityDeduct + eobi + pessi,
  );
  const netPay = roundPayrollMoney(basicSalary + entitlementsTotal - deductionsTotal);
  const pendingAdvance = roundPayrollMoney(
    roundPayrollMoney(input.previousAdvance) +
      roundPayrollMoney(input.currentAdvance) -
      advanceDeduction,
  );
  const securityTillDate = roundPayrollMoney(
    roundPayrollMoney(input.securityPrevious) + securityDeduct,
  );

  return {
    workingDays,
    perDay,
    deductedDays,
    extraLecAmount,
    lecturesAmount,
    entitlementsTotal,
    allowancesTotal: entitlementsTotal,
    absentFine,
    deductionsTotal,
    netPay,
    pendingAdvance,
    securityTillDate,
  };
}
