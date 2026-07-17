import { z } from 'zod';

export const paymentMethodSchema = z.enum(['cash', 'bank', 'online', 'other']);

export const recordFeePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: paymentMethodSchema,
  paidAt: z.string().datetime().optional(),
});

export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>;

export const checkoutSchema = z.object({
  invoiceId: z.string().min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const mockConfirmSchema = z.object({
  paymentId: z.string().min(1),
});

export type MockConfirmInput = z.infer<typeof mockConfirmSchema>;
