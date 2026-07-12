'use client';

import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { formatCurrency, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { useInstitution } from '@/providers/institution-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type {
  DashboardBranchPerformanceResponse,
  DashboardMonthlyRevenueResponse,
  DashboardRecentActivitiesResponse,
  DashboardStatsResponse,
  DashboardTodayAttendanceResponse,
  FeesStatsResponse,
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
  const { can } = usePermissions();
  const token = session?.access_token;
  const currency = settings?.currency ?? 'PKR';

  const canManageBranches = can(PERMISSIONS.BRANCHES_MANAGE);
  const canReadBranches = can(PERMISSIONS.BRANCHES_READ);
  const canReadStudents = can(PERMISSIONS.STUDENTS_READ);
  const canManageUsers = can(PERMISSIONS.USERS_MANAGE);
  const canReadAcademic = can(PERMISSIONS.ACADEMIC_READ);
  const canReadAttendance = can(PERMISSIONS.ATTENDANCE_READ);
  const canReadFees = can(PERMISSIONS.FEES_READ);
  const canReadAllActivities = can(PERMISSIONS.DASHBOARD_ACTIVITIES_READ_ALL);
  const canReadBranchActivities = can(PERMISSIONS.DASHBOARD_ACTIVITIES_READ_BRANCH);
  const showRecentActivities = canReadAllActivities || canReadBranchActivities;

  const showOrgStats =
    canManageBranches || canReadStudents || canManageUsers || canReadAcademic;
  const showFeesStats = canReadFees && !canManageBranches && !canReadStudents && !canManageUsers;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => apiClient<DashboardStatsResponse>('/dashboard/stats', { token }),
    enabled: !!token && showOrgStats,
  });

  const { data: feesStats, isLoading: feesStatsLoading } = useQuery({
    queryKey: queryKeys.feesStats,
    queryFn: () => apiClient<FeesStatsResponse>('/fees/stats', { token }),
    enabled: !!token && showFeesStats,
  });

  const { data: todayAttendance, isLoading: todayAttendanceLoading } = useQuery({
    queryKey: queryKeys.dashboardTodayAttendance,
    queryFn: () =>
      apiClient<DashboardTodayAttendanceResponse>('/dashboard/today-attendance', { token }),
    enabled: !!token && canReadAttendance,
  });

  const { data: monthlyRevenue, isLoading: monthlyRevenueLoading } = useQuery({
    queryKey: queryKeys.dashboardMonthlyRevenue,
    queryFn: () =>
      apiClient<DashboardMonthlyRevenueResponse>('/dashboard/monthly-revenue', { token }),
    enabled: !!token && canReadFees,
  });

  const { data: branchPerformance, isLoading: branchPerformanceLoading } = useQuery({
    queryKey: queryKeys.dashboardBranchPerformance,
    queryFn: () =>
      apiClient<DashboardBranchPerformanceResponse>('/dashboard/branch-performance', { token }),
    enabled: !!token && canReadBranches,
  });

  const { data: recentActivities, isLoading: recentActivitiesLoading } = useQuery({
    queryKey: queryKeys.dashboardRecentActivities,
    queryFn: () =>
      apiClient<DashboardRecentActivitiesResponse>('/dashboard/recent-activities', { token }),
    enabled: !!token && showRecentActivities,
  });

  const showStatsSkeleton = !!token && (statsLoading || (showFeesStats && feesStatsLoading));
  const showChartsSkeleton =
    !!token && ((canReadAttendance && todayAttendanceLoading) || (canReadFees && monthlyRevenueLoading));
  const showBranchPerformanceSkeleton = !!token && canReadBranches && branchPerformanceLoading;
  const showRecentActivitiesSkeleton = !!token && showRecentActivities && recentActivitiesLoading;

  const welcomeName = user?.fullName?.trim() || 'there';

  const orgStatCards = [
    ...(canManageBranches && stats?.totalBranches
      ? [
          {
            label: 'Total Branches',
            value: formatStatValue(stats.totalBranches.total),
            changePercent: stats.totalBranches.changePercent,
          },
        ]
      : []),
    ...(canReadStudents && stats?.totalStudents
      ? [
          {
            label: 'Total Students',
            value: formatStatValue(stats.totalStudents.total),
            changePercent: stats.totalStudents.changePercent,
          },
        ]
      : []),
    ...(canManageUsers && stats?.teachersAndStaff
      ? [
          {
            label: 'Teachers & Staff',
            value: formatStatValue(stats.teachersAndStaff.total),
            changePercent: stats.teachersAndStaff.changePercent,
          },
        ]
      : []),
    ...((canReadAcademic || canReadStudents) && stats?.totalClasses
      ? [
          {
            label: 'Total Classes',
            value: formatStatValue(stats.totalClasses.total),
            changePercent: stats.totalClasses.changePercent,
          },
        ]
      : []),
  ];

  const feeStatCards =
    canReadFees && feesStats
      ? [
          {
            label: 'Outstanding',
            value: formatCurrency(feesStats.outstandingAmount.total),
            changePercent: feesStats.outstandingAmount.changePercent,
          },
          {
            label: 'Collected (30d)',
            value: formatCurrency(feesStats.collectedLast30Days.total),
            changePercent: feesStats.collectedLast30Days.changePercent,
          },
          {
            label: 'Overdue Invoices',
            value: formatStatValue(feesStats.overdueCount.total),
            changePercent: feesStats.overdueCount.changePercent,
          },
          {
            label: 'Invoices Issued',
            value: formatStatValue(feesStats.invoicesIssued.total),
            changePercent: feesStats.invoicesIssued.changePercent,
          },
        ]
      : [];

  const primaryStats = showFeesStats ? feeStatCards : orgStatCards;
  const showFeesAsPrimary = showFeesStats && feeStatCards.length > 0;
  const showOrgAsPrimary = !showFeesAsPrimary && orgStatCards.length > 0;

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

          {(showOrgAsPrimary || showFeesAsPrimary) && primaryStats.length > 0 && (
            <MainStatsSection stats={primaryStats} />
          )}

          {(canReadAttendance || canReadFees) && (
            <div
              className={
                canReadAttendance && canReadFees
                  ? 'grid gap-4 lg:grid-cols-2'
                  : 'grid gap-4'
              }
            >
              {canReadAttendance && (
                <TodayAttendanceCard
                  data={todayAttendance}
                  isLoading={showChartsSkeleton}
                  showStaffRings={canManageUsers}
                />
              )}
              {canReadFees && (
                <MonthlyRevenueCard
                  data={monthlyRevenue}
                  isLoading={showChartsSkeleton}
                  currency={currency}
                />
              )}
            </div>
          )}

          {canReadBranches && (
            <BranchPerformanceCard
              data={branchPerformance}
              isLoading={showBranchPerformanceSkeleton}
              showViewAll={canManageBranches}
            />
          )}

          <div
            className={
              showRecentActivities ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'
            }
          >
            {showRecentActivities && (
              <RecentActivitiesCard
                data={recentActivities}
                isLoading={showRecentActivitiesSkeleton}
                scopeLabel={
                  canReadAllActivities
                    ? 'Live feed across all branches'
                    : 'Live feed for your branch'
                }
              />
            )}
            <QuickActionsCard isLoading={false} />
          </div>
        </>
      )}
    </div>
  );
}
