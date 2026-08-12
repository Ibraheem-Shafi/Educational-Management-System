'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  UserRound,
  ClipboardCheck,
  FileText,
  Wallet,
  Calendar,
  BookOpen,
} from 'lucide-react';
import { currencyStat, formatCurrency } from '@eims/shared';
import type { LearningResourceResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  DAY_NAMES,
  PORTAL_PARENT_KEY,
  attendanceRatePercents,
  type ParentAiSummary,
  type ParentPortalData,
} from '@/lib/portal-types';
import { formatLearningDueDate } from '@/lib/portal-learning';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { MetricDonutCard } from '@/components/dashboard/metric-donut-card';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';
import { ComingSoonFrame } from '@/components/coming-soon';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

export default function ParentChildOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.access_token;

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

  const { data: dueSoon } = useQuery({
    queryKey: queryKeys.portalParentLearningDueSoon(id),
    queryFn: () =>
      apiClient<{ data: LearningResourceResponse[] }>(
        `/portal/parent/learning/due-soon?studentId=${encodeURIComponent(id)}`,
        { token },
      ),
    enabled: !!token && !!id,
  });

  if (isLoading) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load child overview.</p>;

  const child = data?.children.find((c) => c.student.id === id);
  if (!child) {
    return (
      <div className="space-y-4 font-[family-name:var(--font-inter)]">
        <Link
          href="/portal/parent"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)] hover:text-text-main-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <p className="text-sm text-[var(--text-sub-500)]">Child not found or not linked to your account.</p>
      </div>
    );
  }

  const aiChild = aiSummary?.children.find((c) => c.student.fullName === child.student.fullName);
  const rates = attendanceRatePercents(child.attendance);
  const gradeTrend =
    child.assessments
      .filter((a) => a.percentage != null)
      .slice()
      .reverse()
      .map((a, i) => ({
        label: a.assessment?.slice(0, 8) || `T${i + 1}`,
        value: a.percentage ?? 0,
      })) ?? [];
  const avgGrade =
    gradeTrend.length > 0
      ? Math.round(gradeTrend.reduce((s, p) => s + p.value, 0) / gradeTrend.length)
      : 0;
  const dueSoonItems = dueSoon?.data?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <div className="space-y-3">
        <Link
          href="/portal/parent"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)] hover:text-text-main-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <PageHeader
          icon={UserRound}
          title={child.student.fullName}
          description={`Relationship: ${child.relationshipCode}`}
        />
      </div>

      <MainStatsSection
        stats={[
          { label: 'Attendance (present)', value: `${rates.present}%` },
          { label: 'Outstanding fees', ...currencyStat(child.fees.outstanding) },
          { label: 'Average grade', value: `${avgGrade}%` },
          { label: 'Weekly classes', value: String(child.timetable?.length ?? 0) },
        ]}
      />

      <ContentPanel title="Quick links">
        <div className="grid gap-2 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: `/portal/parent/attendance?childId=${id}`, label: 'Attendance', icon: ClipboardCheck },
            { href: `/portal/parent/assessments?childId=${id}`, label: 'Assessments', icon: FileText },
            { href: `/portal/parent/fees?childId=${id}`, label: 'Fees', icon: Wallet },
            { href: `/portal/parent/timetable?childId=${id}`, label: 'Timetable', icon: Calendar },
            { href: `/portal/parent/learning?childId=${id}`, label: 'Learning', icon: BookOpen },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-lg border border-stroke-soft-200 px-3 py-2 text-sm font-medium text-text-main-900 transition-colors hover:bg-neutral-50"
              >
                <Icon className="h-4 w-4 shrink-0 text-icon-primary" strokeWidth={1.5} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </ContentPanel>

      <ContentPanel
        title="Upcoming homework"
        actions={
          <Link
            href={`/portal/parent/learning?childId=${id}`}
            className="text-sm font-medium text-[var(--institution-primary)] hover:underline"
          >
            View all
          </Link>
        }
      >
        {dueSoonItems.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No homework due soon</p>
        ) : (
          <ul className="divide-y divide-stroke-soft-200 sm:flex sm:divide-x sm:divide-y-0">
            {dueSoonItems.map((item) => (
              <li key={item.id} className="min-w-0 flex-1">
                <Link
                  href={`/portal/parent/learning/${item.id}?childId=${id}`}
                  className="block px-5 py-4 transition-colors hover:bg-neutral-50"
                >
                  <p className="truncate text-sm font-medium text-text-main-900">{item.title}</p>
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

      {aiChild && (
        <ComingSoonFrame featureId="portal-insights">
          <ContentPanel title="AI performance summary">
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--text-sub-500)]">{aiChild.narrative}</p>
              {aiChild.overallPercentage !== null && (
                <p className="text-sm font-medium text-text-main-900">
                  Overall: {aiChild.overallPercentage}%
                </p>
              )}
              {aiChild.recommendations.length > 0 && (
                <ul className="space-y-1 text-sm text-[var(--text-sub-500)]">
                  {aiChild.recommendations.map((r, i) => (
                    <li key={i}>
                      <span className="font-medium text-text-main-900">{r.subject}:</span> {r.tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ContentPanel>
        </ComingSoonFrame>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricDonutCard
          title="Attendance mix"
          subtitle="Last 30 days"
          segments={[
            { label: 'Present', rate: rates.present, color: '#38C793' },
            { label: 'Absent', rate: rates.absent, color: '#EF4444' },
            { label: 'Late', rate: rates.late, color: '#F59E0B' },
          ]}
        />
        <TrendAreaChart
          title="Grade trend"
          subtitle="Recent assessments"
          data={gradeTrend}
          totalValue={`${avgGrade}%`}
          gradientId={`parentChildGrade-${id}`}
          valueFormatter={(v) => `${v}%`}
        />
      </div>

      <ContentPanel title="Recent attendance">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[420px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Date</th>
                <th className={dataTableThClass}>Status</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {(child.attendance?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No attendance records
                  </td>
                </tr>
              ) : (
                child.attendance?.map((row, i) => (
                  <tr key={`${row.date}-${i}`}>
                    <td className={dataTableTdClass}>{row.date}</td>
                    <td className={dataTableTdClass}>
                      <StatusBadge label={row.status?.label ?? '—'} code={row.status?.code} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentPanel>

      <ContentPanel title="Assessments">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[480px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Assessment</th>
                <th className={dataTableThClass}>Grade</th>
                <th className={dataTableThClass}>Percentage</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {child.assessments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No assessment records
                  </td>
                </tr>
              ) : (
                child.assessments.map((row, i) => (
                  <tr key={i}>
                    <td className={dataTableTdClass}>{row.assessment ?? 'Test'}</td>
                    <td className={dataTableTdClass}>{row.grade ?? '—'}</td>
                    <td className={dataTableTdClass}>
                      {row.percentage != null ? `${row.percentage}%` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentPanel>

      <ContentPanel title="Timetable">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[520px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Day</th>
                <th className={dataTableThClass}>Time</th>
                <th className={dataTableThClass}>Subject</th>
                <th className={dataTableThClass}>Room</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {(child.timetable?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No timetable published
                  </td>
                </tr>
              ) : (
                child.timetable?.map((slot, i) => (
                  <tr key={i}>
                    <td className={dataTableTdClass}>
                      {DAY_NAMES[slot.dayOfWeek] ?? slot.dayOfWeek}
                    </td>
                    <td className={dataTableTdClass}>
                      {slot.startTime}–{slot.endTime}
                    </td>
                    <td className={dataTableTdClass}>{slot.subjectName ?? '—'}</td>
                    <td className={dataTableTdClass}>{slot.room ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentPanel>

      <ContentPanel title={`Fees · Outstanding ${formatCurrency(child.fees.outstanding)}`}>
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[480px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Fee type</th>
                <th className={dataTableThClass}>Amount</th>
                <th className={dataTableThClass}>Status</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {child.fees.recent.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No invoices
                  </td>
                </tr>
              ) : (
                child.fees.recent.map((inv, i) => (
                  <tr key={i}>
                    <td className={dataTableTdClass}>{inv.feeType?.name ?? 'Fee'}</td>
                    <td className={dataTableTdClass}>{formatCurrency(inv.netAmount)}</td>
                    <td className={dataTableTdClass}>
                      {inv.status ? (
                        <StatusBadge label={inv.status.label} code={inv.status.code} />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentPanel>
    </div>
  );
}
