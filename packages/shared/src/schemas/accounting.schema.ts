import { z } from 'zod';
import {
  MSG,
  optionalString,
  requiredId,
  requiredString,
} from '../validation/messages';
import { paginationQuerySchema } from './common.schema';

export const accountTypes = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export const voucherTypes = ['journal', 'receipt', 'payment'] as const;
/** Manual vouchers from Accounting UI — fee receipts are created only via Fees payments. */
export const manualVoucherTypes = ['journal', 'payment'] as const;
export const voucherStatuses = ['draft', 'posted', 'cancelled'] as const;

export const createAccountSchema = z.object({
  branchId: z.string().optional().nullable(),
  code: requiredString('Code', 1, 20),
  name: requiredString('Name', 1, 200),
  type: z.enum(accountTypes, { errorMap: () => ({ message: MSG.select('account type') }) }),
  isActive: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema
  .omit({ code: true })
  .partial()
  .extend({ code: requiredString('Code', 1, 20).optional() });

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const listAccountsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    type: z.enum(accountTypes).optional(),
    search: z.string().optional(),
    activeOnly: z.coerce.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

export const journalLineInputSchema = z.object({
  accountId: requiredId('Account'),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
  memo: optionalString(500),
});

export type JournalLineInput = z.infer<typeof journalLineInputSchema>;

export const createVoucherSchema = z.object({
  branchId: requiredId('Branch'),
  voucherType: z.enum(manualVoucherTypes, {
    errorMap: () => ({ message: MSG.select('voucher type') }),
  }),
  voucherDate: requiredId('Voucher date'),
  narration: optionalString(1000),
  lines: z.array(journalLineInputSchema).min(2),
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;

export const updateVoucherSchema = z.object({
  voucherType: z
    .enum(manualVoucherTypes, { errorMap: () => ({ message: MSG.select('voucher type') }) })
    .optional(),
  voucherDate: requiredId('Voucher date').optional(),
  narration: optionalString(1000).nullable(),
  lines: z.array(journalLineInputSchema).min(2).optional(),
});

export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;

export const listVouchersQuerySchema = z
  .object({
    branchId: z.string().optional(),
    status: z.enum(voucherStatuses).optional(),
    voucherType: z.enum(voucherTypes).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export type ListVouchersQuery = z.infer<typeof listVouchersQuerySchema>;

export const budgetLineInputSchema = z.object({
  accountId: requiredId('Account'),
  amount: z.coerce.number().min(0),
});

export type BudgetLineInput = z.infer<typeof budgetLineInputSchema>;

export const createBudgetSchema = z.object({
  branchId: z.string().optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100),
  name: requiredString('Name', 1, 200),
  lines: z.array(budgetLineInputSchema).min(1),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = z.object({
  name: requiredString('Name', 1, 200).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  lines: z.array(budgetLineInputSchema).min(1).optional(),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export const listBudgetsQuerySchema = z
  .object({
    branchId: z.string().optional(),
    year: z.coerce.number().int().optional(),
  })
  .merge(paginationQuerySchema);

export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;

export const trialBalanceQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;

export const incomeExpenseQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type IncomeExpenseQuery = z.infer<typeof incomeExpenseQuerySchema>;

export const accountStatementQuerySchema = z.object({
  branchId: z.string().optional(),
  accountId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AccountStatementQuery = z.infer<typeof accountStatementQuerySchema>;

export const budgetVsActualQuerySchema = z.object({
  branchId: z.string().optional(),
  budgetId: z.string().optional(),
  year: z.coerce.number().int().optional(),
});

export type BudgetVsActualQuery = z.infer<typeof budgetVsActualQuerySchema>;
