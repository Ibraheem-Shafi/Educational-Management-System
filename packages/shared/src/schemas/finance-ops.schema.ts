import { z } from 'zod';
import { MSG, optionalEmail, optionalPhone, optionalString, requiredId, requiredString } from '../validation/messages';
import { refineEndAfterStart } from '../validation/date-range';
import { paginationQuerySchema } from './common.schema';

export const vendorBillCategories = [
  'general',
  'electricity',
  'gas',
  'water',
  'phone',
  'maintenance',
  'procurement',
  'asset',
] as const;
export const utilityBillCategories = ['electricity', 'gas', 'water', 'phone'] as const;
export const vendorPaymentMethods = ['cash', 'bank', 'cheque'] as const;
export const drawingMethods = ['cash', 'cheque'] as const;
export const vendorBillStatuses = ['open', 'partial', 'paid', 'void'] as const;
export const bankStatementStatuses = ['open', 'reconciled'] as const;
export const purchaseOrderStatuses = ['draft', 'sent', 'received', 'cancelled'] as const;
export const fixedAssetStatuses = ['active', 'disposed'] as const;
export const fixedAssetScopes = ['school', 'class'] as const;
export const fixedAssetCategories = [
  'furniture',
  'chairs',
  'equipment',
  'electronics',
  'other',
] as const;

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

export const payVendorBillSchema = z
  .object({
    amount: z.coerce.number().positive(),
    paidAt: requiredId('Payment date'),
    method: z.enum(vendorPaymentMethods, { errorMap: () => ({ message: MSG.select('method') }) }).optional().nullable(),
    chequeNumber: optionalString(50).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'cheque' && !data.chequeNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.required('Cheque number'),
        path: ['chequeNumber'],
      });
    }
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

export const createBankStatementSchema = z.object({
  branchId: requiredId('Branch'),
  accountId: z.string().optional().nullable(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  bankName: requiredString('Bank name', 1, 200),
  chequeBookNo: optionalString(50).nullable(),
  chequeBookSerialFrom: optionalString(50).nullable(),
  chequeBookSerialTo: optionalString(50).nullable(),
  status: z.enum(bankStatementStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
});
export type CreateBankStatementInput = z.infer<typeof createBankStatementSchema>;
export const updateBankStatementSchema = createBankStatementSchema.omit({ branchId: true }).partial();
export type UpdateBankStatementInput = z.infer<typeof updateBankStatementSchema>;
export const listBankStatementsQuerySchema = listBase.extend({
  status: z.enum(bankStatementStatuses).optional(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
export type ListBankStatementsQuery = z.infer<typeof listBankStatementsQuerySchema>;

export const createBankStatementLineSchema = z.object({
  issueDate: requiredId('Issue date'),
  chequeNumber: requiredString('Cheque number', 1, 50),
  payee: requiredString('Payee', 1, 200),
  onAccountOf: requiredString('On account of', 1, 200),
  amount: z.coerce.number().positive(),
  useInCampus: optionalString(200).nullable(),
  clearingDate: z.string().optional().nullable(),
});
export type CreateBankStatementLineInput = z.infer<typeof createBankStatementLineSchema>;

export const createOwnerDrawingSchema = z
  .object({
    branchId: requiredId('Branch'),
    drawingDate: requiredId('Date'),
    payee: requiredString('Payee', 1, 200),
    amount: z.coerce.number().positive(),
    method: z.enum(drawingMethods, { errorMap: () => ({ message: MSG.select('method') }) }),
    chequeNumber: optionalString(50).nullable(),
    notes: optionalString(2000).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'cheque' && !data.chequeNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.required('Cheque number'),
        path: ['chequeNumber'],
      });
    }
  });
export type CreateOwnerDrawingInput = z.infer<typeof createOwnerDrawingSchema>;
export const listOwnerDrawingsQuerySchema = listBase;
export type ListOwnerDrawingsQuery = z.infer<typeof listOwnerDrawingsQuerySchema>;

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

export const createFixedAssetSchema = z
  .object({
    branchId: requiredId('Branch'),
    name: requiredString('Name', 1, 200),
    category: z.enum(fixedAssetCategories, { errorMap: () => ({ message: MSG.select('category') }) }),
    scope: z.enum(fixedAssetScopes, { errorMap: () => ({ message: MSG.select('scope') }) }).default('school'),
    quantity: z.coerce.number().int().min(1).default(1),
    batchId: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      requiredId('Class').optional().nullable(),
    ),
    purchaseDate: z.string().optional().nullable(),
    cost: z.coerce.number().min(0),
    vendorBillId: z.string().optional().nullable(),
    purchaseOrderId: z.string().optional().nullable(),
    status: z.enum(fixedAssetStatuses, { errorMap: () => ({ message: MSG.select('status') }) }).optional(),
    notes: optionalString(2000).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'class' && !data.batchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.select('class'),
        path: ['batchId'],
      });
    }
  });
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;
export const updateFixedAssetSchema = z
  .object({
    name: requiredString('Name', 1, 200).optional(),
    category: z.enum(fixedAssetCategories).optional(),
    scope: z.enum(fixedAssetScopes).optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    batchId: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      requiredId('Class').optional().nullable(),
    ),
    purchaseDate: z.string().optional().nullable(),
    cost: z.coerce.number().min(0).optional(),
    vendorBillId: z.string().optional().nullable(),
    purchaseOrderId: z.string().optional().nullable(),
    status: z.enum(fixedAssetStatuses).optional(),
    notes: optionalString(2000).nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'class' && data.batchId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: MSG.select('class'),
        path: ['batchId'],
      });
    }
  });
export type UpdateFixedAssetInput = z.infer<typeof updateFixedAssetSchema>;
export const listFixedAssetsQuerySchema = listBase.extend({
  status: z.enum(fixedAssetStatuses).optional(),
  scope: z.enum(fixedAssetScopes).optional(),
  batchId: z.string().optional(),
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
