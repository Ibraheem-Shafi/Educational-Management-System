import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  feeReminderSchema,
  noticeBroadcastSchema,
  sendMessageSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { FeeReminderInput, NoticeBroadcastInput, SendMessageInput } from '@eims/shared';

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Get('logs')
  @Permissions('communications.send')
  logs() {
    return this.service.listLogs();
  }

  @Post('send')
  @Permissions('communications.send')
  send(
    @Body(createZodPipe(sendMessageSchema)) body: SendMessageInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.sendMessage(body, user);
  }

  @Post('fee-reminders')
  @Permissions('communications.send')
  feeReminders(
    @Body(createZodPipe(feeReminderSchema)) body: FeeReminderInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.service.sendFeeReminders(body, user, branchId);
  }

  @Post('notice-broadcast')
  @Permissions('communications.send')
  noticeBroadcast(
    @Body(createZodPipe(noticeBroadcastSchema)) body: NoticeBroadcastInput,
    @CurrentUser() user: AuthUser,
    @BranchId() branchId: string | null,
  ) {
    return this.service.broadcastNotice(body, user, branchId);
  }
}
