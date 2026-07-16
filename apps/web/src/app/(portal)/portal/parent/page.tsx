'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import { formatCurrency } from '@eims/shared';
import type { LearningResourceResponse, PortalParentStatsResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  PORTAL_PARENT_KEY,
  attendanceRatePercents,
  type ParentAiSummary,
  type ParentPortalData,
} from '@/lib/portal-types';
import { usePortalChildId } from '@/lib/portal-child-context';
import { formatLearningDueDate } from '@/lib/portal-learning';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { MetricDonutCard } from '@/components/dashboard/metric-donut-card';
import { UserAvatar } from '@/components/layout/user-avatar';

export default function ParentPortalHomePage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <ParentPortalHomeContent />
    </Suspense>
  );
}

function ParentPortalHomeContent() {
  const { session } = useAuth();
  const token = session?.access_token;

  useNoticesRealtime(PORTAL_PARENT_KEY);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.portalParentStats,
    queryFn: () => apiClient<PortalParentStatsResponse>('/portal/parent/stats', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: PORTAL_PARENT_KEY,
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token }),
    enabled: !!token,
  });

  const { data: aiSummary } = useQuery({
    queryKey: ['portal-parent-ai-summary'],
    queryFn: () => apiClient<ParentAiSummary>('/ai-insights/portal/parent-summary', { token }),
    enabled: !!token,
  });

  const children = data?.children ?? [];
  const { childId, childHref } = usePortalChildId(children);
  const selectedChild = children.find((c) => c.student.id === childId);

  const { data: dueSoon } = useQuery({
    queryKey: queryKeys.portalParentLearningDueSoon(childId ?? ''),
    queryFn: () =>
      apiClient<{ data: LearningResourceResponse[] }>(
        `/portal/parent/learning/due-soon?studentId=${encodeURIComponent(childId!)}`,
        { token },
      ),
    enabled: !!token && !!childId,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load portal.</p>;

  const allAttendance = children.flatMap((c) => c.attendance ?? []);
  const rates = attendanceRatePercents(allAttendance);
  const notices = data?.notices?.slice(0, 3) ?? [];
  const dueSoonItems = dueSoon?.data?.slice(0, 3) ?? [];
  const selectedChildName = selectedChild?.student.fullName;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={LayoutDashboard}
        title="Parent portal"
        description={data?.parent ? `Welcome, ${data.parent.fullName}` : 'Welcome'}
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
              label: 'Children',
              value: String(stats?.childrenCount.total ?? 0),
              changePercent: stats?.childrenCount.changePercent,
            },
            {
              label: 'Avg attendance',
              value: `${stats?.aggregateAttendance.total ?? 0}%`,
              changePercent: stats?.aggregateAttendance.changePercent,
            },
            {
              label: 'Total outstanding',
              value: formatCurrency(stats?.totalOutstanding.total ?? 0),
              changePercent: stats?.totalOutstanding.changePercent,
            },
            {
              label: 'Recent notices',
              value: String(stats?.recentNotices.total ?? 0),
              changePercent: stats?.recentNotices.changePercent,
            },
          ]}
        />
      )}

      {children.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricDonutCard
            title="Children attendance"
            subtitle="Combined last 30 days"
            segments={[
              { label: 'Present', rate: rates.present, color: '#38C793' },
              { label: 'Absent', rate: rates.absent, color: '#EF4444' },
              { label: 'Late', rate: rates.late, color: '#F59E0B' },
            ]}
          />

          <ContentPanel
            title="Announcements"
            actions={
              <Link
                href="/portal/parent/notices"
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
      )}

      {childId && (
        <ContentPanel
          title={selectedChildName ? `Due soon · ${selectedChildName}` : 'Due soon'}
          actions={
            <Link
              href={childHref('/portal/parent/learning')}
              className="text-sm font-medium text-[var(--institution-primary)] hover:underline"
            >
              View learning
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
                    href={`/portal/parent/learning/${item.id}?childId=${encodeURIComponent(childId)}`}
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
      )}

      <ContentPanel
        title={`My children (${children.length})`}
        actions={
          <Link
            href="/portal/parent/children"
            className="text-sm font-medium text-[var(--institution-primary)] hover:underline"
          >
            View all
          </Link>
        }
      >
        {children.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No linked children</p>
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {children.map((child) => {
              const aiChild = aiSummary?.children.find(
                (c) => c.student.fullName === child.student.fullName,
              );
              const childRates = attendanceRatePercents(child.attendance);
              const id = child.student.id;
              return (
                <li key={id}>
                  <Link
                    href={childHref('/portal/parent/attendance', id)}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-neutral-50"
                  >
                    <UserAvatar name={child.student.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-text-main-900">
                          {child.student.fullName}
                        </p>
                        <span className="text-xs text-[var(--text-sub-500)]">
                          ({child.relationshipCode})
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                        Attendance {childRates.present}% · Outstanding{' '}
                        {formatCurrency(child.fees.outstanding)}
                        {aiChild?.overallPercentage != null
                          ? ` · Overall ${aiChild.overallPercentage}%`
                          : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-icon-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ContentPanel>
    </div>
  );
}
