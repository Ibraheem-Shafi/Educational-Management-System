'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { currencyStat } from '@eims/shared';
import type { LearningResourceResponse, PortalStudentStatsResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  PORTAL_STUDENT_KEY,
  attendanceRatePercents,
  type StudentPortalData,
} from '@/lib/portal-types';
import { formatLearningDueDate } from '@/lib/portal-learning';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { MetricDonutCard } from '@/components/dashboard/metric-donut-card';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';

export default function StudentPortalHomePage() {
  const { session } = useAuth();
  const token = session?.access_token;

  useNoticesRealtime(PORTAL_STUDENT_KEY);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.portalStudentStats,
    queryFn: () => apiClient<PortalStudentStatsResponse>('/portal/student/stats', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: PORTAL_STUDENT_KEY,
    queryFn: () => apiClient<StudentPortalData>('/portal/student', { token }),
    enabled: !!token,
  });

  const { data: dueSoon } = useQuery({
    queryKey: queryKeys.portalStudentLearningDueSoon,
    queryFn: () =>
      apiClient<{ data: LearningResourceResponse[] }>('/portal/student/learning/due-soon', {
        token,
      }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load portal.</p>;

  const rates = attendanceRatePercents(data?.attendance);
  const gradeTrend =
    data?.assessments
      ?.filter((a) => a.percentage != null)
      .slice(0, 8)
      .reverse()
      .map((a, i) => ({
        label: a.assessment?.slice(0, 8) || `T${i + 1}`,
        value: a.percentage ?? 0,
      })) ?? [];

  const notices = data?.notices?.slice(0, 3) ?? [];
  const dueSoonItems = dueSoon?.data?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={LayoutDashboard}
        title="Student portal"
        description={
          data?.student
            ? `${data.student.fullName} · ${data.student.program?.name ?? '—'} · ${data.student.batch?.name ?? '—'}`
            : 'Welcome'
        }
      />

      {data?.message && (
        <ContentPanel>
          <p className="px-5 py-6 text-center text-sm text-[var(--text-sub-500)]">{data.message}</p>
        </ContentPanel>
      )}

      {(statsLoading || stats) && (
        <MainStatsSection
          isLoading={statsLoading && !stats}
          stats={[
            {
              label: 'Attendance rate',
              value: `${stats?.attendanceRate.total ?? 0}%`,
              changePercent: stats?.attendanceRate.changePercent,
            },
            {
              label: 'Outstanding fees',
              ...currencyStat(stats?.outstandingFees.total ?? 0),
              changePercent: stats?.outstandingFees.changePercent,
            },
            {
              label: 'Average grade',
              value: `${stats?.averageGrade.total ?? 0}%`,
              changePercent: stats?.averageGrade.changePercent,
            },
            {
              label: 'Weekly classes',
              value: String(stats?.upcomingClasses.total ?? 0),
              changePercent: stats?.upcomingClasses.changePercent,
            },
          ]}
        />
      )}

      {data?.student && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <MetricDonutCard
              title="Attendance mix"
              subtitle="Last 30 days"
              segments={[
                { label: 'Present', rate: rates.present, color: 'var(--palette-teal)' },
                { label: 'Absent', rate: rates.absent, color: 'var(--palette-coral)' },
                { label: 'Late', rate: rates.late, color: 'var(--palette-yellow)' },
              ]}
            />
            <TrendAreaChart
              title="Grade trend"
              subtitle="Recent assessments"
              data={gradeTrend}
              totalValue={stats ? `${stats.averageGrade.total}%` : undefined}
              changePercent={stats?.averageGrade.changePercent}
              gradientId="studentGradeTrend"
              valueFormatter={(v) => `${v}%`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ContentPanel
              title="Due soon"
              actions={
                <Link
                  href="/portal/student/learning?type=homework"
                  className="text-sm font-medium text-[var(--institution-primary)] hover:underline"
                >
                  View all
                </Link>
              }
            >
              {dueSoonItems.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No homework due soon</p>
              ) : (
                <ul className="divide-y divide-stroke-soft-200">
                  {dueSoonItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/portal/student/learning/${item.id}`}
                        className="block px-5 py-4 transition-colors hover:bg-neutral-50"
                      >
                        <p className="text-sm font-medium text-text-main-900">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                          {item.subject?.name ? `${item.subject.name} · ` : ''}
                          Due {formatLearningDueDate(item.dueAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ContentPanel>

            <ContentPanel
              title="Announcements"
              actions={
                <Link
                  href="/portal/student/notices"
                  className="text-sm font-medium text-[var(--institution-primary)] hover:underline"
                >
                  View all
                </Link>
              }
            >
              {notices.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No announcements yet</p>
              ) : (
                <ul className="divide-y divide-stroke-soft-200">
                  {notices.map((n) => (
                    <li key={n.title} className="px-5 py-4">
                      <p className="text-sm font-medium text-text-main-900">{n.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-sub-500)]">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </ContentPanel>
          </div>
        </>
      )}
    </div>
  );
}
