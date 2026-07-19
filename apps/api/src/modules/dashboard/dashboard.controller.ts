import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, paginationQuerySchema } from '@eims/shared';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '@eims/types';
import type { PaginationQuery } from '@eims/shared';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser, @BranchId() branchId: string | null) {
    return this.dashboardService.getSummary(user, branchId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser, @BranchId() branchId: string | null) {
    return this.dashboardService.getStats(user, branchId);
  }

  @Get('today-attendance')
  @Permissions('attendance.read')
  getTodayAttendance(@CurrentUser() user: AuthUser, @BranchId() branchId: string | null) {
    return this.dashboardService.getTodayAttendance(user, branchId);
  }

  @Get('monthly-revenue')
  @Permissions('fees.read')
  getMonthlyRevenue(@BranchId() branchId: string | null) {
    return this.dashboardService.getMonthlyRevenue(branchId);
  }

  @Get('branch-performance')
  @Permissions('branches.read')
  getBranchPerformance(
    @BranchId() branchId: string | null,
    @Query(createZodPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.dashboardService.getBranchPerformance(branchId, query);
  }

  @Get('recent-activities')
  getRecentActivities(@CurrentUser() user: AuthUser, @BranchId() branchId: string | null) {
    const canReadAll = user.permissions.includes(PERMISSIONS.DASHBOARD_ACTIVITIES_READ_ALL);
    const canReadBranch = user.permissions.includes(PERMISSIONS.DASHBOARD_ACTIVITIES_READ_BRANCH);

    if (!canReadAll && !canReadBranch) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // read_all → every branch; read_branch only → assigned branch.
    const scopeBranchId = canReadAll ? null : branchId;
    if (!canReadAll && !scopeBranchId) {
      throw new ForbiddenException('No branch assigned');
    }

    return this.dashboardService.getRecentActivities(user, scopeBranchId);
  }
}
