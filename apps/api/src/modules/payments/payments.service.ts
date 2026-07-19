import { prismaBranchFilter, prismaBranchIdFilter, scopeCacheKey, requireSingleBranchId, sqlBranchFilter } from '../../common/utils/branch-scope.util';
import type { BranchScope } from '@eims/shared';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.module';
import { FeesService } from '../fees/fees.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import type { PaymentProvider } from './payment-provider.interface';
import type { AuthUser } from '@eims/types';
import type { CheckoutInput, MockConfirmInput } from '@eims/shared';
import { PERMISSIONS } from '@eims/shared';

type PaymentSucceededCallback = (paymentId: string, invoiceId: string) => Promise<void>;

@Injectable()
export class PaymentsService {
  private paymentSucceededCallbacks: PaymentSucceededCallback[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly feesService: FeesService,
    private readonly accountingPosting: AccountingPostingService,
    private readonly config: ConfigService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly stripeProvider: StripePaymentProvider,
  ) {}

  registerPaymentSucceededCallback(callback: PaymentSucceededCallback): void {
    this.paymentSucceededCallbacks.push(callback);
  }

  async onPaymentSucceeded(paymentId: string, invoiceId: string): Promise<void> {
    for (const callback of this.paymentSucceededCallbacks) {
      await callback(paymentId, invoiceId);
    }
  }

  private resolveProvider(): PaymentProvider {
    const provider = this.config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
    if (provider === 'stripe' && this.config.get<string>('STRIPE_SECRET_KEY')?.trim()) {
      return this.stripeProvider;
    }
    return this.mockProvider;
  }

  private getWebUrl(): string {
    return (this.config.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  async createCheckout(input: CheckoutInput, user: AuthUser, scope: BranchScope) {
    const canCheckout =
      user.permissions.includes(PERMISSIONS.PAYMENTS_CHECKOUT) ||
      user.permissions.includes('fees.collect');
    if (!canCheckout) throw new ForbiddenException('Payment checkout not permitted');

    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: input.invoiceId, ...prismaBranchFilter(scope) },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        payments: { where: { status: { in: ['succeeded', 'pending'] } } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.assertCanPayInvoice(user, invoice.studentId, invoice.branchId);

    const status = await this.prisma.lookupStatus.findUnique({ where: { id: invoice.statusId } });
    if (status?.code === 'waived') throw new BadRequestException('Invoice is waived');
    if (status?.code === 'paid') throw new BadRequestException('Invoice is already paid');

    const paidSucceeded = invoice.payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Math.max(0, Number(invoice.netAmount) - paidSucceeded);
    if (remaining <= 0) throw new BadRequestException('Nothing left to pay');

    const pendingOnline = invoice.payments.find((p) => p.status === 'pending' && p.method === 'online');
    if (pendingOnline) {
      const provider = this.resolveProvider();
      const webUrl = this.getWebUrl();
      const session = await provider.createCheckout({
        paymentId: pendingOnline.id,
        invoiceId: invoice.id,
        amount: Number(pendingOnline.amount),
        currency: 'pkr',
        description: `Fee invoice ${invoice.id.slice(-8)}`,
        successUrl: `${webUrl}/portal/fees/pay/${pendingOnline.id}?status=success`,
        cancelUrl: `${webUrl}/portal/fees/pay/${pendingOnline.id}?status=cancelled`,
        customerEmail: invoice.student.email ?? user.email,
      });
      return {
        paymentId: pendingOnline.id,
        checkoutUrl: session.checkoutUrl,
        amount: Number(pendingOnline.amount),
        provider: provider.name,
      };
    }

    const provider = this.resolveProvider();
    const payment = await this.prisma.feePayment.create({
      data: {
        invoiceId: invoice.id,
        branchId: invoice.branchId,
        amount: remaining,
        method: 'online',
        provider: provider.name,
        status: 'pending',
        recordedById: user.id,
      },
    });

    const webUrl = this.getWebUrl();
    const session = await provider.createCheckout({
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: remaining,
      currency: 'pkr',
      description: `Fee invoice ${invoice.id.slice(-8)}`,
      successUrl: `${webUrl}/portal/fees/pay/${payment.id}?status=success`,
      cancelUrl: `${webUrl}/portal/fees/pay/${payment.id}?status=cancelled`,
      customerEmail: invoice.student.email ?? user.email,
    });

    if (session.providerRef) {
      await this.prisma.feePayment.update({
        where: { id: payment.id },
        data: { providerRef: session.providerRef },
      });
    }

    return {
      paymentId: payment.id,
      checkoutUrl: session.checkoutUrl,
      amount: remaining,
      provider: provider.name,
    };
  }

  async confirmMock(input: MockConfirmInput, user: AuthUser) {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id: input.paymentId },
      include: { invoice: { select: { studentId: true, branchId: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.provider !== 'mock') {
      throw new BadRequestException('Only mock payments can be confirmed via this endpoint');
    }

    await this.assertCanPayInvoice(user, payment.invoice.studentId, payment.branchId);

    if (payment.status === 'succeeded') {
      return { paymentId: payment.id, status: 'succeeded', alreadyConfirmed: true };
    }

    const paidAt = new Date();
    await this.prisma.feePayment.update({
      where: { id: payment.id },
      data: { status: 'succeeded', paidAt },
    });

    await this.feesService.syncInvoiceAfterPayment(payment.invoiceId);
    await this.accountingPosting.postFeePayment(
      payment.id,
      payment.branchId,
      Number(payment.amount),
      user.id,
    );
    await this.onPaymentSucceeded(payment.id, payment.invoiceId);

    return { paymentId: payment.id, status: 'succeeded', paidAt: paidAt.toISOString() };
  }

  async handleStripeWebhook(payload: unknown, signature?: string) {
    const event = this.stripeProvider.parseWebhookPayload(payload, signature);
    if (!event) return { received: true, handled: false };

    let payment = event.paymentId
      ? await this.prisma.feePayment.findUnique({ where: { id: event.paymentId } })
      : null;

    if (!payment && event.providerRef) {
      payment = await this.prisma.feePayment.findFirst({
        where: { providerRef: event.providerRef },
      });
    }

    if (!payment) throw new NotFoundException('Payment not found for webhook event');

    if (event.status === 'succeeded' && payment.status !== 'succeeded') {
      const paidAt = event.paidAt ?? new Date();
      await this.prisma.feePayment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          paidAt,
          ...(event.meta ? { meta: event.meta as object } : {}),
        },
      });
      await this.feesService.syncInvoiceAfterPayment(payment.invoiceId);
      await this.accountingPosting.postFeePayment(
        payment.id,
        payment.branchId,
        Number(payment.amount),
      );
      await this.onPaymentSucceeded(payment.id, payment.invoiceId);
    } else if (event.status === 'failed' && payment.status === 'pending') {
      await this.prisma.feePayment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          ...(event.meta ? { meta: event.meta as object } : {}),
        },
      });
    }

    return { received: true, handled: true, paymentId: payment.id, status: event.status };
  }

  async getPaymentForPortal(paymentId: string, user: AuthUser) {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            student: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.assertCanPayInvoice(user, payment.invoice.studentId, payment.branchId);

    const feeType = await this.prisma.feeType.findUnique({ where: { id: payment.invoice.feeTypeId } });

    return {
      id: payment.id,
      amount: Number(payment.amount),
      method: payment.method,
      provider: payment.provider,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
      invoice: {
        id: payment.invoice.id,
        netAmount: Number(payment.invoice.netAmount),
        feeType: feeType ? { name: feeType.name } : null,
        student: payment.invoice.student,
      },
    };
  }

  private async assertCanPayInvoice(user: AuthUser, studentId: string, branchId: string | null) {
    const hasCheckout = user.permissions.includes(PERMISSIONS.PAYMENTS_CHECKOUT);
    const hasCollect = user.permissions.includes('fees.collect');

    if (hasCollect) {
      if (branchId && user.branchId && user.branchId !== branchId && !user.roles.includes('super_admin')) {
        throw new ForbiddenException('Branch access denied');
      }
      return;
    }

    if (!hasCheckout) throw new ForbiddenException('Payment checkout not permitted');

    if (user.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: { email: user.email, deletedAt: null },
      });
      if (!student || student.id !== studentId) {
        throw new ForbiddenException('Invoice access denied');
      }
      return;
    }

    if (user.roles.includes('parent')) {
      const parent = await this.prisma.parent.findFirst({
        where: { email: user.email, deletedAt: null },
        include: { studentParents: { where: { studentId } } },
      });
      if (!parent || parent.studentParents.length === 0) {
        throw new ForbiddenException('Invoice access denied');
      }
      return;
    }

    throw new ForbiddenException('Invoice access denied');
  }
}
