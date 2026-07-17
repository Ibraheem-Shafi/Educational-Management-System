import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  WebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string | undefined {
    return this.config.get<string>('STRIPE_SECRET_KEY')?.trim() || undefined;
  }

  private ensureConfigured(): string {
    const key = this.secretKey;
    if (!key) throw new BadRequestException('Stripe not configured');
    return key;
  }

  async createCheckout(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const secretKey = this.ensureConfigured();

    const body = new URLSearchParams({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      'line_items[0][price_data][currency]': input.currency,
      'line_items[0][price_data][product_data][name]': input.description,
      'line_items[0][price_data][unit_amount]': String(Math.round(input.amount * 100)),
      'line_items[0][quantity]': '1',
      'metadata[paymentId]': input.paymentId,
      'metadata[invoiceId]': input.invoiceId,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new BadRequestException(`Stripe checkout failed: ${errText.slice(0, 200)}`);
    }

    const session = (await res.json()) as { id: string; url: string };
    return { checkoutUrl: session.url, providerRef: session.id };
  }

  parseWebhookPayload(payload: unknown, signature?: string): WebhookEvent | null {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (webhookSecret && signature) {
      this.verifySignature(JSON.stringify(payload), signature, webhookSecret);
    }

    const event = payload as {
      type?: string;
      data?: { object?: Record<string, unknown> };
    };

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object ?? {};
      const metadata = (session.metadata ?? {}) as Record<string, string>;
      return {
        providerRef: String(session.id ?? ''),
        paymentId: metadata.paymentId,
        status: 'succeeded',
        paidAt: new Date(),
        meta: session as Record<string, unknown>,
      };
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data?.object ?? {};
      const metadata = (session.metadata ?? {}) as Record<string, string>;
      return {
        providerRef: String(session.id ?? ''),
        paymentId: metadata.paymentId,
        status: 'failed',
        meta: session as Record<string, unknown>,
      };
    }

    return null;
  }

  private verifySignature(rawBody: string, signatureHeader: string, secret: string): void {
    const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) {
      throw new BadRequestException('Invalid Stripe signature header');
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new BadRequestException('Stripe webhook signature verification failed');
    }
  }
}
