import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { StudentsService } from '../students/students.service';
import { TtlCacheService } from '../../common/cache/ttl-cache.service';
import type { AuthUser } from '@eims/types';

const SUMMARY_CACHE_TTL_MS = 45_000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly reports: ReportsService,
    private readonly analytics: AnalyticsService,
    private readonly students: StudentsService,
    private readonly ttlCache: TtlCacheService,
  ) {}

  async getSummary(user: AuthUser, branchId: string | null) {
    const cacheKey = `dashboard:summary:${branchId ?? 'all'}:${user.id}`;
    const cached = this.ttlCache.get<Awaited<ReturnType<DashboardService['buildSummary']>>>(cacheKey);
    if (cached) return cached;

    const result = await this.buildSummary(user, branchId);
    this.ttlCache.set(cacheKey, result, SUMMARY_CACHE_TTL_MS);
    return result;
  }

  private async buildSummary(user: AuthUser, branchId: string | null) {
    const canViewReports = user.permissions.includes('reports.view');
    const canViewAnalytics = user.permissions.includes('analytics.read');

    const [overview, analytics, recentStudents] = await Promise.all([
      canViewReports ? this.reports.getOverview(branchId) : Promise.resolve(null),
      canViewAnalytics ? this.analytics.getDashboardKpis(branchId) : Promise.resolve(null),
      this.students.findAll({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }, branchId),
    ]);

    return { overview, analytics, recentStudents };
  }
}
