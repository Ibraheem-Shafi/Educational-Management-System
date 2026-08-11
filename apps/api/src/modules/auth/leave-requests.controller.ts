import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortalService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createEmployeeLeaveRequestSchema,
  leaveAttachmentMetaSchema,
  listLeaveRequestsQuerySchema,
  prepareLeaveAttachmentUploadSchema,
  reviewLeaveSchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type {
  BranchScope,
  CreateEmployeeLeaveRequestInput,
  LeaveAttachmentMetaInput,
  ListLeaveRequestsQuery,
  PrepareLeaveAttachmentUploadInput,
  ReviewLeaveInput,
} from '@eims/shared';

@ApiTags('leave-requests')
@ApiBearerAuth()
@Controller('leave-requests')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class LeaveRequestsController {
  constructor(private readonly portalService: PortalService) {}

  @Get()
  @Permissions('leave.read')
  list(
    @BranchScopeParam() scope: BranchScope,
    @Query(createZodPipe(listLeaveRequestsQuerySchema)) query: ListLeaveRequestsQuery,
  ) {
    return this.portalService.listStaffLeaveRequests(scope, query.kind, query.page, query.limit);
  }

  @Get('mine')
  @Permissions('leave.request')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query(createZodPipe(listLeaveRequestsQuerySchema)) query: ListLeaveRequestsQuery,
  ) {
    return this.portalService.listMyEmployeeLeaveRequests(user, query.page, query.limit);
  }

  @Post()
  @Permissions('leave.request')
  create(
    @CurrentUser() user: AuthUser,
    @Body(createZodPipe(createEmployeeLeaveRequestSchema)) body: CreateEmployeeLeaveRequestInput,
  ) {
    return this.portalService.createEmployeeLeaveRequest(user, body);
  }

  @Post(':id/attachment/upload-url')
  @Permissions('leave.request')
  prepareAttachmentUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(createZodPipe(prepareLeaveAttachmentUploadSchema)) body: PrepareLeaveAttachmentUploadInput,
  ) {
    return this.portalService.prepareLeaveAttachmentUpload(user, id, body);
  }

  @Post(':id/attachment')
  @Permissions('leave.request')
  setAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(createZodPipe(leaveAttachmentMetaSchema)) body: LeaveAttachmentMetaInput,
  ) {
    return this.portalService.setLeaveAttachment(user, id, body);
  }

  @Get(':id/attachment/signed-url')
  attachmentSignedUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.portalService.getLeaveAttachmentSignedUrl(user, id);
  }

  @Patch(':id')
  @Permissions('leave.manage')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(createZodPipe(reviewLeaveSchema)) body: ReviewLeaveInput,
  ) {
    return this.portalService.reviewLeaveRequest(user, id, body.status);
  }
}
