'use client';

import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useInstitution } from '@/providers/institution-provider';
import { apiClient } from '@/lib/api-client';
import type {
  DashboardBranchPerformanceResponse,
  DashboardMonthlyRevenueResponse,
  DashboardRecentActivitiesResponse,
  DashboardStatsResponse,
  DashboardTodayAttendanceResponse,
} from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { DashboardPageSkeleton } from '@/components/layout/dashboard-page-skeleton';
import { TodayAttendanceCard } from '@/components/dashboard/today-attendance-card';
import { MonthlyRevenueCard } from '@/components/dashboard/monthly-revenue-card';
import { BranchPerformanceCard } from '@/components/dashboard/branch-performance-card';
import { RecentActivitiesCard } from '@/components/dashboard/recent-activities-card';
import { QuickActionsCard } from '@/components/dashboard/quick-actions-card';

function formatStatValue(value: number): string {
  return value.toLocaleString('en-US');
}

export default function DashboardPage() {
  const { session, user } = useAuth();
  const { settings } = useInstitution();
  const token = session?.access_token;
  const currency = settings?.currency ?? 'PKR';

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => apiClient<DashboardStatsResponse>('/dashboard/stats', { token }),
    enabled: !!token,
  });

  const { data: todayAttendance, isLoading: todayAttendanceLoading } = useQuery({
    queryKey: queryKeys.dashboardTodayAttendance,
    queryFn: () => apiClient<DashboardTodayAttendanceResponse>('/dashboard/today-attendance', { token }),
    enabled: !!token,
  });

  const { data: monthlyRevenue, isLoading: monthlyRevenueLoading } = useQuery({
    queryKey: queryKeys.dashboardMonthlyRevenue,
    queryFn: () => apiClient<DashboardMonthlyRevenueResponse>('/dashboard/monthly-revenue', { token }),
    enabled: !!token,
  });

  const { data: branchPerformance, isLoading: branchPerformanceLoading } = useQuery({
    queryKey: queryKeys.dashboardBranchPerformance,
    queryFn: () => apiClient<DashboardBranchPerformanceResponse>('/dashboard/branch-performance', { token }),
    enabled: !!token,
  });

  const { data: recentActivities, isLoading: recentActivitiesLoading } = useQuery({
    queryKey: queryKeys.dashboardRecentActivities,
    queryFn: () => apiClient<DashboardRecentActivitiesResponse>('/dashboard/recent-activities', { token }),
    enabled: !!token,
  });

  const showStatsSkeleton = !!token && statsLoading;
  const showChartsSkeleton = !!token && (todayAttendanceLoading || monthlyRevenueLoading);
  const showBranchPerformanceSkeleton = !!token && branchPerformanceLoading;
  const showBottomSectionSkeleton = !!token && recentActivitiesLoading;

  const welcomeName = user?.fullName?.trim() || 'there';

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description={user ? `Welcome back, ${welcomeName}` : undefined}
      />

      {!user ? (
        <DashboardPageSkeleton hideHeader section="full" />
      ) : (
        <>
          {showStatsSkeleton && <MainStatsSection isLoading stats={[]} />}

          {stats && (
            <MainStatsSection
              stats={[
                {
                  label: 'Total Branches',
                  value: formatStatValue(stats.totalBranches.total),
                  changePercent: stats.totalBranches.changePercent,
                },
                {
                  label: 'Total Students',
                  value: formatStatValue(stats.totalStudents.total),
                  changePercent: stats.totalStudents.changePercent,
                },
                {
                  label: 'Teachers & Staff',
                  value: formatStatValue(stats.teachersAndStaff.total),
                  changePercent: stats.teachersAndStaff.changePercent,
                },
                {
                  label: 'Total Classes',
                  value: formatStatValue(stats.totalClasses.total),
                  changePercent: stats.totalClasses.changePercent,
                },
              ]}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <TodayAttendanceCard
              data={todayAttendance}
              isLoading={showChartsSkeleton}
            />
            <MonthlyRevenueCard
              data={monthlyRevenue}
              isLoading={showChartsSkeleton}
              currency={currency}
            />
          </div>

          <BranchPerformanceCard
            data={branchPerformance}
            isLoading={showBranchPerformanceSkeleton}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentActivitiesCard
              data={recentActivities}
              isLoading={showBottomSectionSkeleton}
            />
            <QuickActionsCard isLoading={showBottomSectionSkeleton} />
          </div>
        </>
      )}
    </div>
  );
}
