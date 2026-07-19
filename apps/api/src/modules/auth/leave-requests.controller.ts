import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortalService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createEmployeeLeaveRequestSchema, listLeaveRequestsQuerySchema, reviewLeaveSchema } from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateEmployeeLeaveRequestInput, ListLeaveRequestsQuery, ReviewLeaveInput } from '@eims/shared';

@ApiTags('leave-requests')
@ApiBearerAuth()
@Controller('leave-requests')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class LeaveRequestsController {
  constructor(private readonly portalService: PortalService) {}

  @Get()
  @Permissions('leave.read')
  list(
    @BranchId() branchId: string | null,
    @Query(createZodPipe(listLeaveRequestsQuerySchema)) query: ListLeaveRequestsQuery,
  ) {
    return this.portalService.listStaffLeaveRequests(branchId, query.kind, query.page, query.limit);
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
