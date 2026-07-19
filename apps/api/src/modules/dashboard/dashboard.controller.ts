import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, isSingleBranchScope, paginationQuerySchema } from '@eims/shared';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, CurrentUser, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '@eims/types';
import type { BranchScope, PaginationQuery } from '@eims/shared';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser, @BranchScopeParam() scope: BranchScope) {
    return this.dashboardService.getSummary(user, scope);
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser, @BranchScopeParam() scope: BranchScope) {
    return this.dashboardService.getStats(user, scope);
  }

  @Get('today-attendance')
  @Permissions('attendance.read')
  getTodayAttendance(@CurrentUser() user: AuthUser, @BranchScopeParam() scope: BranchScope) {
    return this.dashboardService.getTodayAttendance(user, scope);
  }

  @Get('monthly-revenue')
  @Permissions('fees.read')
  getMonthlyRevenue(@BranchScopeParam() scope: BranchScope) {
    return this.dashboardService.getMonthlyRevenue(scope);
  }

  @Get('branch-performance')
  @Permissions('branches.read')
  getBranchPerformance(
    @BranchScopeParam() scope: BranchScope,
    @Query(createZodPipe(paginationQuerySchema)) query: PaginationQuery,
  ) {
    return this.dashboardService.getBranchPerformance(scope, query);
  }

  @Get('recent-activities')
  getRecentActivities(@CurrentUser() user: AuthUser, @BranchScopeParam() scope: BranchScope) {
    const canReadAll = user.permissions.includes(PERMISSIONS.DASHBOARD_ACTIVITIES_READ_ALL);
    const canReadBranch = user.permissions.includes(PERMISSIONS.DASHBOARD_ACTIVITIES_READ_BRANCH);

    if (!canReadAll && !canReadBranch) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // read_all → whatever scope was resolved (all or selected); read_branch only → single branch.
    if (!canReadAll && !isSingleBranchScope(scope)) {
      throw new ForbiddenException('No branch assigned');
    }

    return this.dashboardService.getRecentActivities(user, scope);
  }
}
