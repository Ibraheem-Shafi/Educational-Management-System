import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PortalService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createLeaveRequestSchema,
  portalCalendarQuerySchema,
  portalSectionQuerySchema,
} from '@eims/shared';
import type { AuthUser } from '@eims/types';
import type { CreateLeaveRequestInput } from '@eims/shared';

const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

@ApiTags('leave-requests')
@ApiBearerAuth()
@Controller('leave-requests')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class LeaveRequestsController {
  constructor(private readonly portalService: PortalService) {}

  @Get()
  @Permissions('students.read')
  list(@BranchId() branchId: string | null) {
    return this.portalService.listStaffLeaveRequests(branchId);
  }

  @Patch(':id')
  @Permissions('students.update')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(createZodPipe(reviewLeaveSchema)) body: z.infer<typeof reviewLeaveSchema>,
  ) {
    return this.portalService.reviewLeaveRequest(user, id, body.status);
  }
}
