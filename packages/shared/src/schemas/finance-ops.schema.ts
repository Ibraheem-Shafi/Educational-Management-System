import { z } from 'zod';
import { MSG, optionalEmail, optionalPhone, optionalString, requiredId, requiredString } from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';
import { paginationQuerySchema } from './common.schema';

export const vendorBillCategories = [
  'general',
  'utility',
  'maintenance',
  'procurement',
  'asset',
] as const;
export const vendorBillStatuses = ['open', 'partial', 'paid', 'void'] as const;
export const bankStatementStatuses = ['open', 'reconciled'] as const;
export const purchaseOrderStatuses = ['draft', 'sent', 'received', 'cancelled'] as const;
export const fixedAssetStatuses = ['active', 'disposed'] as const;

const listBase = z
  .object({
    branchId: z.string().optional(),
    search: z.string().optional(),
  })
  .merge(paginationQuerySchema);

export const createVendorSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Name', 1, 200),
  phone: optionalPhone(),
  email: optionalEmail(),
  notes: optionalString(2000).nullable(),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export const updateVendorSchema = createVendorSchema.omit({ branchId: true }).partial();
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export const listVendorsQuerySchema = listBase;
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;

export const createVendorBillSchema = z.object({
  branchId: requiredId('Branch'),
  vendorId: requiredId('Vendor'),
  billNo: optionalString(50).nullable(),
  billDate: requiredId('Bill date'),
  dueDate: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  category: z.enum(vendorBillCategories, { errorMap: () => ({ message: MSG.select('category') }) }),
  description: optionalString(2000).nullable(),
  purchaseOrderId: z.string().optional().nullable(),
});
export type CreateVendorBillInput = z.infer<typeof createVendorBillSchema>;
export const updateVendorBillSchema = createVendorBillSchema.omit({ branchId: true, vendorId: true }).partial();
export type UpdateVendorBillInput = z.infer<typeof updateVendorBillSchema>;
export const listVendorBillsQuerySchema = listBase.extend({
  vendorId: z.string().optional(),
  category: z.enum(vendorBillCategories).optional(),
  status: z.enum(vendorBillStatuses).optional(),
});
export type ListVendorBillsQuery = z.infer<typeof listVendorBillsQuerySchema>;

export const payVendorBillSchema = z.object({
  amount: z.coerce.number().positive(),
  paidAt: requiredId('Payment date'),
  method: optionalString(50).nullable(),
});
export type PayVendorBillInput = z.infer<typeof payVendorBillSchema>;

export const createPettyCashFundSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Name', 1, 200),
  openingBalance: z.coerce.number().min(0).optional(),
});
export type CreatePettyCashFundInput = z.infer<typeof createPettyCashFundSchema>;
export const updatePettyCashFundSchema = createPettyCashFundSchema.omit({ branchId: true }).partial();
export type UpdatePettyCashFundInput = z.infer<typeof updatePettyCashFundSchema>;
export const listPettyCashFundsQuerySchema = listBase;
export type ListPettyCashFundsQuery = z.infer<typeof listPettyCashFundsQuerySchema>;

export const createPettyCashVoucherSchema = z.object({
  branchId: requiredId('Branch'),
  fundId: requiredId('Fund'),
  voucherDate: requiredId('Voucher date'),
  amount: z.coerce.number().positive(),
  payee: requiredString('Payee', 1, 200),
  description: requiredString('Description', 1, 500),
});
export type CreatePettyCashVoucherInput = z.infer<typeof createPettyCashVoucherSchema>;
export const updatePettyCashVoucherSchema = createPettyCashVoucherSchema.omit({ branchId: true }).partial();
export type UpdatePettyCashVoucherInput = z.infer<typeof updatePettyCashVoucherSchema>;
export const listPettyCashVouchersQuerySchema = listBase.extend({
  fundId: z.string().optional(),
});
export type ListPettyCashVouchersQuery = z.infer<typeof listPettyCashVouchersQuerySchema>;

export const createBankStatementSchema = refineEndAfterStart(
  z.object({
    branchId: requiredId('Branch'),
    accountId: z.string().optional().nullable(),
    periodFrom: requiredId('Period from'),
    periodTo: requiredId('Period to'),
  }),
  'periodFrom',
  'periodTo',
  { allowEqual: true },
);
export type CreateBankStatementInput = z.infer<typeof createBankStatementSchema>;
export const updateBankStatementSchema = z.object({
  accountId: z.string().optional().nullable(),
  periodFrom: requiredId('Period from').optional(),
  periodTo: requiredId('Period to').optional(),
  status: z.enum(bankStatementStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
});
export type UpdateBankStatementInput = z.infer<typeof updateBankStatementSchema>;
export const listBankStatementsQuerySchema = listBase.extend({
  status: z.enum(bankStatementStatuses).optional(),
});
export type ListBankStatementsQuery = z.infer<typeof listBankStatementsQuerySchema>;

export const createBankStatementLineSchema = z.object({
  lineDate: requiredId('Line date'),
  amount: z.coerce.number(),
  description: requiredString('Description', 1, 500),
});
export type CreateBankStatementLineInput = z.infer<typeof createBankStatementLineSchema>;

export const matchBankStatementLineSchema = z
  .object({
    journalLineId: z.string().optional().nullable(),
    feePaymentId: z.string().optional().nullable(),
    clear: z.boolean().optional(),
  })
  .refine((value) => value.clear || value.journalLineId || value.feePaymentId, {
    message: 'Select a journal line or fee payment to match',
  });
export type MatchBankStatementLineInput = z.infer<typeof matchBankStatementLineSchema>;

export const createPurchaseOrderSchema = z.object({
  branchId: requiredId('Branch'),
  vendorId: requiredId('Vendor'),
  poNo: requiredString('PO number', 1, 50),
  orderDate: requiredId('Order date'),
  status: z.enum(purchaseOrderStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  notes: optionalString(2000).nullable(),
  lines: z
    .array(
      z.object({
        description: requiredString('Description', 1, 200),
        quantity: z.coerce.number().positive(),
        unitCost: z.coerce.number().min(0),
      }),
    )
    .min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export const updatePurchaseOrderSchema = z.object({
  vendorId: requiredId('Vendor').optional(),
  poNo: requiredString('PO number', 1, 50).optional(),
  orderDate: requiredId('Order date').optional(),
  status: z.enum(purchaseOrderStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  notes: optionalString(2000).nullable(),
  lines: z
    .array(
      z.object({
        description: requiredString('Description', 1, 200),
        quantity: z.coerce.number().positive(),
        unitCost: z.coerce.number().min(0),
      }),
    )
    .min(1)
    .optional(),
});
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;
export const listPurchaseOrdersQuerySchema = listBase.extend({
  vendorId: z.string().optional(),
  status: z.enum(purchaseOrderStatuses).optional(),
});
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;

export const receivePurchaseOrderSchema = z.object({
  receivedAt: requiredId('Received date'),
  notes: optionalString(2000).nullable(),
});
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;

export const createFixedAssetSchema = z.object({
  branchId: requiredId('Branch'),
  name: requiredString('Name', 1, 200),
  category: requiredString('Category', 1, 100),
  purchaseDate: z.string().optional().nullable(),
  cost: z.coerce.number().min(0),
  vendorBillId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  status: z.enum(fixedAssetStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
  notes: optionalString(2000).nullable(),
});
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;
export const updateFixedAssetSchema = createFixedAssetSchema.omit({ branchId: true }).partial();
export type UpdateFixedAssetInput = z.infer<typeof updateFixedAssetSchema>;
export const listFixedAssetsQuerySchema = listBase.extend({
  status: z.enum(fixedAssetStatuses).optional(),
});
export type ListFixedAssetsQuery = z.infer<typeof listFixedAssetsQuerySchema>;

export const createBudgetForecastLineSchema = z.object({
  budgetId: requiredId('Budget'),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number(),
});
export type CreateBudgetForecastLineInput = z.infer<typeof createBudgetForecastLineSchema>;
export const updateBudgetForecastLineSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  amount: z.coerce.number().optional(),
});
export type UpdateBudgetForecastLineInput = z.infer<typeof updateBudgetForecastLineSchema>;
export const listBudgetForecastLinesQuerySchema = listBase.extend({
  budgetId: z.string().optional(),
});
export type ListBudgetForecastLinesQuery = z.infer<typeof listBudgetForecastLinesQuerySchema>;

export const financeOpsReportQuerySchema = refineEndAfterStart(
  z.object({
    branchId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  'from',
  'to',
  { allowEqual: true },
);
export type FinanceOpsReportQuery = z.infer<typeof financeOpsReportQuerySchema>;
