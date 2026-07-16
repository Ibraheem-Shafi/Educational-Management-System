import { Skeleton } from '@/components/ui/skeleton';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { TodayAttendanceCard } from '@/components/dashboard/today-attendance-card';
import { MonthlyRevenueCard } from '@/components/dashboard/monthly-revenue-card';
import { BranchPerformanceCard } from '@/components/dashboard/branch-performance-card';
import { RecentActivitiesCard } from '@/components/dashboard/recent-activities-card';
import { QuickActionsCard } from '@/components/dashboard/quick-actions-card';

export function DashboardPageSkeleton({
  section = 'full',
  hideHeader = false,
}: {
  section?: 'overview' | 'charts' | 'branches' | 'bottom' | 'full';
  hideHeader?: boolean;
}) {
  const showHeader = !hideHeader && (!section || section === 'full');
  const showOverview = !section || section === 'full' || section === 'overview';
  const showCharts = !section || section === 'full' || section === 'charts';
  const showBranches = !section || section === 'full' || section === 'branches';
  const showBottom = !section || section === 'full' || section === 'bottom';

  if (section === 'overview') {
    return <MainStatsSection isLoading stats={[]} />;
  }

  if (section === 'charts') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <TodayAttendanceCard isLoading />
        <MonthlyRevenueCard isLoading />
      </div>
    );
  }

  if (section === 'branches') {
    return <BranchPerformanceCard isLoading />;
  }

  if (section === 'bottom') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivitiesCard isLoading />
        <QuickActionsCard isLoading />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-5 w-56" />
          </div>
        </div>
      )}

      {showOverview && <MainStatsSection isLoading stats={[]} />}

      {showCharts && (
        <div className="grid gap-4 lg:grid-cols-2">
          <TodayAttendanceCard isLoading />
          <MonthlyRevenueCard isLoading />
        </div>
      )}

      {showBranches && <BranchPerformanceCard isLoading />}

      {showBottom && (
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentActivitiesCard isLoading />
          <QuickActionsCard isLoading />
        </div>
      )}
    </div>
  );
}
