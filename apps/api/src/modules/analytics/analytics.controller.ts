import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchId, Permissions } from '../../common/decorators/auth.decorators';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import {
  analyticsCorrelationQuerySchema,
  analyticsPerformanceQuerySchema,
  analyticsTrendsQuerySchema,
  analyticsWeakSubjectsQuerySchema,
} from '@eims/shared';
import type {
  AnalyticsCorrelationQuery,
  AnalyticsPerformanceQuery,
  AnalyticsTrendsQuery,
  AnalyticsWeakSubjectsQuery,
} from '@eims/shared';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('analytics.read')
  dashboard(@BranchId() branchId: string | null) {
    return this.analyticsService.getDashboardKpis(branchId);
  }

  @Get('attendance-trends')
  @Permissions('analytics.read')
  attendanceTrends(
    @Query(createZodPipe(analyticsTrendsQuerySchema)) query: AnalyticsTrendsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.analyticsService.getAttendanceTrends(query, branchId);
  }

  @Get('performance')
  @Permissions('analytics.read')
  performance(
    @Query(createZodPipe(analyticsPerformanceQuerySchema)) query: AnalyticsPerformanceQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.analyticsService.getPerformance(query, branchId);
  }

  @Get('rankings')
  @Permissions('analytics.read')
  rankings(
    @Query('assessmentId') assessmentId: string | undefined,
    @BranchId() branchId: string | null,
  ) {
    return this.analyticsService.getRankings(branchId, assessmentId);
  }

  @Get('weak-subjects')
  @Permissions('analytics.read')
  weakSubjects(
    @Query(createZodPipe(analyticsWeakSubjectsQuerySchema)) query: AnalyticsWeakSubjectsQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.analyticsService.getWeakSubjects(query, branchId);
  }

  @Get('attendance-performance-correlation')
  @Permissions('analytics.read')
  attendancePerformanceCorrelation(
    @Query(createZodPipe(analyticsCorrelationQuerySchema)) query: AnalyticsCorrelationQuery,
    @BranchId() branchId: string | null,
  ) {
    return this.analyticsService.getAttendancePerformanceCorrelation(query, branchId);
  }
}
