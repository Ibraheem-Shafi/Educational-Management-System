import { z } from 'zod';
import {
  MSG,
  requiredId,
  requiredPositiveNumber,
} from '../validation/messages';

export const paymentMethodSchema = z.enum(['cash', 'bank', 'online', 'other'], {
  errorMap: () => ({ message: MSG.select('payment method') }),
});

export const recordFeePaymentSchema = z.object({
  amount: requiredPositiveNumber('Amount'),
  method: paymentMethodSchema,
  paidAt: z.string().datetime({ message: MSG.invalidDate }).optional(),
});

export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>;

export const checkoutSchema = z.object({
  invoiceId: requiredId('Invoice'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const mockConfirmSchema = z.object({
  paymentId: requiredId('Payment'),
});

export type MockConfirmInput = z.infer<typeof mockConfirmSchema>;
