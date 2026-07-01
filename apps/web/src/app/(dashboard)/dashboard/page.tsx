'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { ListRowLink } from '@/components/layout/list-row-link';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { DashboardPageSkeleton } from '@/components/layout/dashboard-page-skeleton';

interface Overview {
  students: { total: number };
  fees: { pendingAmount: number; collectedAmount: number; pendingCount: number };
  attendanceMarkedToday: number;
  parents: number;
  staffUsers: number;
}

interface AnalyticsKpis {
  averageAssessmentPercentage: number | null;
  attendanceRateLast30Days: number;
  assessmentsLast30Days: number;
}

interface StudentRow {
  id: string;
  fullName: string;
}

export default function DashboardPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: queryKeys.reportsOverview,
    queryFn: () => apiClient<Overview>('/reports/overview', { token }),
    enabled: !!token && user?.permissions.includes('reports.view'),
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.studentsRecent,
    queryFn: () => apiClient<PaginatedResponse<StudentRow>>('/students?limit=5', { token }),
    enabled: !!token,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: queryKeys.analyticsDashboard,
    queryFn: () => apiClient<AnalyticsKpis>('/analytics/dashboard', { token }),
    enabled: !!token && user?.permissions.includes('analytics.read'),
  });

  const canViewOverview = !!token && user?.permissions.includes('reports.view');
  const canViewAnalytics = !!token && user?.permissions.includes('analytics.read');
  const showOverviewSkeleton = canViewOverview && overviewLoading;
  const showAnalyticsSkeleton = canViewAnalytics && analyticsLoading;
  const showStudentsSkeleton = !!token && studentsLoading;

  if (!user) {
    return <DashboardPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back, ${user.fullName}`} />

      {showOverviewSkeleton && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {overview && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.students.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Fees collected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(overview.fees.collectedAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(overview.fees.pendingAmount)} pending ({overview.fees.pendingCount})
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Attendance today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.attendanceMarkedToday}</p>
              <p className="text-xs text-muted-foreground">records marked</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Parents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{overview.parents}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {showAnalyticsSkeleton && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analytics && (
        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Performance (30 days)</h2>
            <LinkButton href="/dashboard/analytics">Full analytics</LinkButton>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg assessment %</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{analytics.averageAssessmentPercentage ?? '—'}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Attendance rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{analytics.attendanceRateLast30Days}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Assessments held</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{analytics.assessmentsLast30Days}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent students</CardTitle>
          <LinkButton href="/dashboard/students">View all</LinkButton>
        </CardHeader>
        <CardContent>
          {showStudentsSkeleton ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="block h-10 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
          <div className="divide-y divide-border">
            {students?.data.map((s) => (
              <ListRowLink key={s.id} href={`/dashboard/students/${s.id}`}>
                <p className="font-medium">{s.fullName}</p>
              </ListRowLink>
            ))}
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
