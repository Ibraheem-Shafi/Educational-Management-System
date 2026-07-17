import { z } from 'zod';

export const salaryComponentKinds = ['allowance', 'deduction'] as const;
export const payrollRunStatuses = [
  'draft',
  'pending_approval',
  'approved',
  'finalized',
] as const;

export const salaryComponentSchema = z.object({
  kind: z.enum(salaryComponentKinds),
  name: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
  percentOfBasic: z.coerce.number().min(0).max(100).optional().nullable(),
});

export type SalaryComponentInput = z.infer<typeof salaryComponentSchema>;

export const createSalaryStructureSchema = z.object({
  userId: z.string().min(1),
  branchId: z.string().min(1),
  basicSalary: z.coerce.number().min(0),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  components: z.array(salaryComponentSchema).default([]),
});

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;

export const updateSalaryStructureSchema = createSalaryStructureSchema
  .omit({ userId: true, branchId: true })
  .partial();

export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;

export const listSalaryStructuresQuerySchema = z.object({
  branchId: z.string().optional(),
  userId: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().optional(),
});

export type ListSalaryStructuresQuery = z.infer<typeof listSalaryStructuresQuerySchema>;

export const createPayrollRunSchema = z.object({
  branchId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

export const adjustPayrollLineSchema = z.object({
  adjustmentsTotal: z.coerce.number(),
  reason: z.string().max(500).optional().nullable(),
});

export type AdjustPayrollLineInput = z.infer<typeof adjustPayrollLineSchema>;

export const listPayrollRunsQuerySchema = z.object({
  branchId: z.string().optional(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(payrollRunStatuses).optional(),
});

export type ListPayrollRunsQuery = z.infer<typeof listPayrollRunsQuerySchema>;

export const exportPayrollRunQuerySchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
});

export type ExportPayrollRunQuery = z.infer<typeof exportPayrollRunQuerySchema>;
