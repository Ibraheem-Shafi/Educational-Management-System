export interface CheckoutSessionInput {
  paymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  providerRef?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
}

export interface WebhookEvent {
  providerRef: string;
  paymentId?: string;
  status: 'succeeded' | 'failed';
  paidAt?: Date;
  meta?: Record<string, unknown>;
}
