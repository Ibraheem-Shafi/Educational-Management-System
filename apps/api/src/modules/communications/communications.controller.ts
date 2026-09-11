import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  absenceAlertSchema,
  broadcastCampaignSchema,
  feeReminderSchema,
  listCommunicationLogsQuerySchema,
  noticeBroadcastSchema,
  previewAudienceSchema,
  sendMessageSchema,
} from '@eims/shared';
import { getSingleBranchId } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  AbsenceAlertInput,
  BranchScope,
  BroadcastCampaignInput,
  FeeReminderInput,
  ListCommunicationLogsQuery,
  NoticeBroadcastInput,
  PreviewAudienceInput,
  SendMessageInput,
} from '@eims/shared';

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Get('config')
  @Permissions('communications.send')
  config() {
    return this.service.getProviderConfig();
  }

  @Get('stats')
  @Permissions('communications.send')
  stats() {
    return this.service.getStats();
  }

  @Get('logs')
  @Permissions('communications.send')
  logs(
    @Query(createZodPipe(listCommunicationLogsQuerySchema)) query: ListCommunicationLogsQuery,
  ) {
    return this.service.listLogs(query);
  }

  @Post('preview-audience')
  @Permissions('communications.send')
  previewAudience(
    @Body(createZodPipe(previewAudienceSchema)) body: PreviewAudienceInput,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.previewAudience(body, scope);
  }

  @Post('broadcast')
  @Permissions('communications.send')
  broadcast(
    @Body(createZodPipe(broadcastCampaignSchema)) body: BroadcastCampaignInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.broadcastCampaign(body, user, scope);
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
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.sendFeeReminders(body, user, scope);
  }

  @Post('absence-alerts')
  @Permissions('attendance.mark')
  absenceAlerts(
    @Body(createZodPipe(absenceAlertSchema)) body: AbsenceAlertInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.sendAbsenceAlerts(
      { ...body, branchId: getSingleBranchId(scope) ?? body.branchId },
      user,
    );
  }

  @Post('notice-broadcast')
  @Permissions('communications.send')
  noticeBroadcast(
    @Body(createZodPipe(noticeBroadcastSchema)) body: NoticeBroadcastInput,
    @CurrentUser() user: AuthUser,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.service.broadcastNotice(body, user, scope);
  }
}
