import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeParam, Permissions } from '../../common/decorators/auth.decorators';
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
  BranchScope,
} from '@eims/shared';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(AuthGuard, BranchGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Permissions('analytics.read')
  dashboard(@BranchScopeParam() scope: BranchScope) {
    return this.analyticsService.getDashboardKpis(scope);
  }

  @Get('attendance-trends')
  @Permissions('analytics.read')
  attendanceTrends(
    @Query(createZodPipe(analyticsTrendsQuerySchema)) query: AnalyticsTrendsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.analyticsService.getAttendanceTrends(query, scope);
  }

  @Get('performance')
  @Permissions('analytics.read')
  performance(
    @Query(createZodPipe(analyticsPerformanceQuerySchema)) query: AnalyticsPerformanceQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.analyticsService.getPerformance(query, scope);
  }

  @Get('rankings')
  @Permissions('analytics.read')
  rankings(
    @Query('assessmentId') assessmentId: string | undefined,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.analyticsService.getRankings(scope, assessmentId);
  }

  @Get('weak-subjects')
  @Permissions('analytics.read')
  weakSubjects(
    @Query(createZodPipe(analyticsWeakSubjectsQuerySchema)) query: AnalyticsWeakSubjectsQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.analyticsService.getWeakSubjects(query, scope);
  }

  @Get('attendance-performance-correlation')
  @Permissions('analytics.read')
  attendancePerformanceCorrelation(
    @Query(createZodPipe(analyticsCorrelationQuerySchema)) query: AnalyticsCorrelationQuery,
    @BranchScopeParam() scope: BranchScope,
  ) {
    return this.analyticsService.getAttendancePerformanceCorrelation(query, scope);
  }
}
