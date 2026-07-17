import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentProvider } from './payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  constructor(private readonly config: ConfigService) {}

  async createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const webUrl = (this.config.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    const checkoutUrl = `${webUrl}/portal/fees/pay/${input.paymentId}?invoiceId=${input.invoiceId}`;

    return { checkoutUrl };
  }
}
