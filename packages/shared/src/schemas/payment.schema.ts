import { z } from 'zod';
import {
  MSG,
  requiredId,
  requiredPositiveNumber,
  requiredString,
} from '../validation/messages';

export const paymentMethodSchema = z.enum(['cash', 'bank', 'online', 'other'], {
  errorMap: () => ({ message: MSG.select('payment method') }),
});

export const paymentReceiptSchema = z.object({
  storagePath: requiredString('Storage path', 1, 500),
  fileName: requiredString('File name', 1, 255),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export type PaymentReceiptInput = z.infer<typeof paymentReceiptSchema>;

export const recordFeePaymentSchema = z
  .object({
    amount: requiredPositiveNumber('Amount'),
    method: paymentMethodSchema,
    paidAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
    /** Bank UTR / online transaction id */
    providerRef: z
      .string()
      .trim()
      .max(120, MSG.maxLength('Transaction reference', 120))
      .optional(),
    receipt: paymentReceiptSchema.optional(),
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

export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>;

export const prepareFeePaymentReceiptUploadSchema = z.object({
  fileName: requiredString('File name', 1, 255),
});

export type PrepareFeePaymentReceiptUploadInput = z.infer<
  typeof prepareFeePaymentReceiptUploadSchema
>;

export const checkoutSchema = z.object({
  invoiceId: requiredId('Invoice'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const mockConfirmSchema = z.object({
  paymentId: requiredId('Payment'),
});

export type MockConfirmInput = z.infer<typeof mockConfirmSchema>;
