'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Building2, ChevronRight, Download, FileBarChart, Wallet } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { useBatches } from '@/hooks/use-batches';
import { downloadCsv } from '@/lib/download-csv';
import { formatCurrency, formatCurrencyCompact, PERMISSIONS } from '@eims/shared';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { metricRowClass } from '@/components/layout/status-badge';
import type { ReportsOverviewResponse } from '@eims/types';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { catalogCounts, REPORT_GROUP_META, type ReportGroup } from '@/lib/report-catalog';

const thClass =
  'h-9 border-0 bg-[var(--palette-teal-soft)] px-4 text-left text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--palette-navy)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

interface CorrelationStudent {
  studentId: string;
  fullName: string;
  attendanceRate: number;
  averagePercentage: number;
}

const HUB_CARDS: Array<{ group: ReportGroup; icon: typeof BookOpen }> = [
  { group: 'academic', icon: BookOpen },
  { group: 'finance', icon: Wallet },
  { group: 'administration', icon: Building2 },
];

export default function ReportsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canViewReports = can(PERMISSIONS.REPORTS_VIEW);
  const canViewAnalytics = can(PERMISSIONS.ANALYTICS_READ);
  const [correlationBatchId, setCorrelationBatchId] = useState('');

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: [...queryKeys.reportsOverview, scopeKey],
    queryFn: () =>
      apiClient<ReportsOverviewResponse>(withBranchScope('/reports/overview', effectiveScope), {
        token,
      }),
    enabled: !!token && canViewReports,
  });

  const { data: batches } = useBatches(token, singleBranchId ?? '', undefined, !!canViewAnalytics);

  const { data: correlation, isLoading: correlationLoading } = useQuery({
    queryKey: ['analytics-correlation', correlationBatchId],
    queryFn: () =>
      apiClient<{
        periodDays: number;
        correlation: number | null;
        students: CorrelationStudent[];
      }>(
        `/analytics/attendance-performance-correlation${correlationBatchId ? `?batchId=${correlationBatchId}` : ''}`,
        { token },
      ),
    enabled: !!token && canViewAnalytics,
  });

  const collectionRate =
    overview && overview.fees.collectedAmount + overview.fees.pendingAmount > 0
      ? Math.round(
          (overview.fees.collectedAmount /
            (overview.fees.collectedAmount + overview.fees.pendingAmount)) *
            1000,
        ) / 10
      : null;

  const topCorrelationStudents = useMemo(
    () =>
      [...(correlation?.students ?? [])]
        .sort((a, b) => b.averagePercentage - a.averagePercentage)
        .slice(0, 15),
    [correlation?.students],
  );

  const batchOptions = [
    { value: '', label: 'All batches' },
    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];

  if (!canViewReports) {
    return (
      <div className="space-y-6 font-[family-name:var(--font-inter)]">
        <PageHeader icon={FileBarChart} title="Reports" description="Named report catalogs and insights" />
        <p className="text-sm text-[var(--text-sub-500)]">You do not have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={FileBarChart}
        title="Reports"
        description="Named catalogs for academics, finance, and administration"
      />

      <div className="flex justify-end">
        <PageBranchScopeControl />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {HUB_CARDS.map(({ group, icon: Icon }) => {
          const meta = REPORT_GROUP_META[group];
          const counts = catalogCounts(group);
          return (
            <ContentPanel
              key={group}
              title={
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--palette-teal)]" strokeWidth={1.75} />
                  {meta.title}
                </span>
              }
            >
              <div className="space-y-4 px-5 py-5">
                <p className="text-sm text-[var(--text-sub-500)]">{meta.description}</p>
                <p className="text-sm font-medium text-[var(--text-main-900)]">
                  {counts.ready} ready / {counts.comingSoon} coming soon
                </p>
                <Button size="sm" asChild>
                  <Link href={meta.href}>
                    Open catalog
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </ContentPanel>
          );
        })}
      </div>

      <MainStatsSection
        isLoading={overviewLoading}
        stats={[
          {
            label: 'Students',
            value: overview?.students.total ?? 0,
            changePercent: overview?.students.changePercent,
          },
          {
            label: 'Parents',
            value: overview?.parents.total ?? 0,
            changePercent: overview?.parents.changePercent,
          },
          {
            label: 'Staff users',
            value: overview?.staffUsers ?? 0,
          },
          {
            label: 'Attendance today',
            value: overview?.attendanceMarkedToday.count ?? 0,
            changePercent: overview?.attendanceMarkedToday.changePercent,
          },
        ]}
      />

      {overview && (
        <ContentPanel
          title="Collection summary"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  'collection-summary.csv',
                  ['Metric', 'Value'],
                  [
                    ['Collected amount', overview.fees.collectedAmount],
                    ['Pending amount', overview.fees.pendingAmount],
                    ['Paid invoices', overview.fees.paidCount],
                    ['Pending invoices', overview.fees.pendingCount],
                    ['Collection rate %', collectionRate ?? ''],
                  ],
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          }
        >
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-sub-500)]">Collected</p>
              <Tooltip content={formatCurrency(overview.fees.collectedAmount)} className="w-full">
                <p className="truncate text-xl font-semibold text-[var(--text-main-900)]">
                  {formatCurrencyCompact(overview.fees.collectedAmount)}
                </p>
              </Tooltip>
              <p className="text-xs text-[var(--text-sub-500)]">
                {overview.fees.paidCount} paid invoices
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-sub-500)]">Pending</p>
              <Tooltip content={formatCurrency(overview.fees.pendingAmount)} className="w-full">
                <p className="truncate text-xl font-semibold text-[var(--text-main-900)]">
                  {formatCurrencyCompact(overview.fees.pendingAmount)}
                </p>
              </Tooltip>
              <p className="text-xs text-[var(--text-sub-500)]">
                {overview.fees.pendingCount} unpaid invoices
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-sub-500)]">Collection rate</p>
              <p className="text-xl font-semibold text-[var(--text-main-900)]">{collectionRate ?? '—'}%</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-sub-500)]">Total billed</p>
              <Tooltip
                content={formatCurrency(
                  overview.fees.collectedAmount + overview.fees.pendingAmount,
                )}
                className="w-full"
              >
                <p className="truncate text-xl font-semibold text-[var(--text-main-900)]">
                  {formatCurrencyCompact(
                    overview.fees.collectedAmount + overview.fees.pendingAmount,
                  )}
                </p>
              </Tooltip>
            </div>
          </div>
        </ContentPanel>
      )}

      {canViewAnalytics && (
        <ContentPanel
          title="Attendance vs performance correlation"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SelectDropdown
                aria-label="Filter by batch"
                placeholder="All batches"
                value={correlationBatchId}
                onValueChange={setCorrelationBatchId}
                options={batchOptions}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!correlation?.students.length}
                onClick={() =>
                  downloadCsv(
                    'attendance-performance-correlation.csv',
                    ['Student', 'Attendance rate %', 'Average assessment %'],
                    (correlation?.students ?? []).map((s) => [
                      s.fullName,
                      s.attendanceRate,
                      s.averagePercentage,
                    ]),
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          }
        >
          <div className="space-y-4 px-5 pb-5 pt-4">
            {correlation && (
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-[var(--text-sub-500)]">Period: </span>
                  <span className="font-medium text-[var(--text-main-900)]">{correlation.periodDays} days</span>
                </div>
                <div>
                  <span className="text-[var(--text-sub-500)]">Pearson correlation: </span>
                  <span className="font-medium text-[var(--text-main-900)]">
                    {correlation.correlation != null ? correlation.correlation : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-sub-500)]">Students with data: </span>
                  <span className="font-medium text-[var(--text-main-900)]">{correlation.students.length}</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={thClass}>Student</th>
                    <th className={cn(thClass, 'text-right')}>Attendance %</th>
                    <th className={cn(thClass, 'text-right')}>Performance %</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {correlationLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={3} className={tdClass}>
                          <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                        </td>
                      </tr>
                    ))}
                  {!correlationLoading && topCorrelationStudents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                        Not enough attendance and assessment data to show correlation
                      </td>
                    </tr>
                  )}
                  {!correlationLoading &&
                    topCorrelationStudents.map((s) => (
                      <tr key={s.studentId} className={metricRowClass(s.averagePercentage)}>
                        <td className={tdClass}>{s.fullName}</td>
                        <td className={cn(tdClass, 'text-right')}>{s.attendanceRate}%</td>
                        <td className={cn(tdClass, 'text-right')}>{s.averagePercentage}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </ContentPanel>
      )}
    </div>
  );
}
