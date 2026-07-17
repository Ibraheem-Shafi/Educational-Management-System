import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { BranchId, CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { checkoutSchema, mockConfirmSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CheckoutInput, MockConfirmInput } from '@eims/shared';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, BranchGuard)
  @HttpCode(HttpStatus.CREATED)
  createCheckout(
    @Body(createZodPipe(checkoutSchema)) body: CheckoutInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.paymentsService.createCheckout(body, user, branchId);
  }

  @Get(':paymentId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  getPayment(@Param('paymentId') paymentId: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.getPaymentForPortal(paymentId, user);
  }

  @Post('webhooks/mock')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  confirmMock(
    @Body(createZodPipe(mockConfirmSchema)) body: MockConfirmInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.confirmMock(body, user);
  }

  @Post('webhooks/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  stripeWebhook(
    @Req() req: { body: unknown; headers: Record<string, string | string[] | undefined> },
  ) {
    const signature = req.headers['stripe-signature'];
    return this.paymentsService.handleStripeWebhook(
      req.body,
      typeof signature === 'string' ? signature : undefined,
    );
  }
}
