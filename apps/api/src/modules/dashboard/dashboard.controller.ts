import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthUser } from '@eims/types';

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
  getStats(@BranchId() branchId: string | null) {
    return this.dashboardService.getStats(branchId);
  }

  @Get('today-attendance')
  getTodayAttendance(@BranchId() branchId: string | null) {
    return this.dashboardService.getTodayAttendance(branchId);
  }

  @Get('monthly-revenue')
  getMonthlyRevenue(@BranchId() branchId: string | null) {
    return this.dashboardService.getMonthlyRevenue(branchId);
  }

  @Get('branch-performance')
  getBranchPerformance(@BranchId() branchId: string | null) {
    return this.dashboardService.getBranchPerformance(branchId);
  }

  @Get('recent-activities')
  getRecentActivities(@BranchId() branchId: string | null) {
    return this.dashboardService.getRecentActivities(branchId);
  }
}
