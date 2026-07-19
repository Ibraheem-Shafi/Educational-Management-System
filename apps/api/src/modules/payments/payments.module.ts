import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './mock-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { FeesModule } from '../fees/fees.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [FeesModule, AccountingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MockPaymentProvider, StripePaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
