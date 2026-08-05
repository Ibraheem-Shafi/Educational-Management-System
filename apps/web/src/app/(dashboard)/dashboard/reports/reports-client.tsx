'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileBarChart } from 'lucide-react';
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
import { PaginationBar } from '@/components/layout/pagination-bar';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import type { PaginatedResponse, ReportsOverviewResponse } from '@eims/types';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

interface FeeDefaulter {
  id: string;
  student: { fullName: string; phone: string | null };
  feeType: { name: string } | null;
  netAmount: number;
  dueDate: string | null;
}

interface CorrelationStudent {
  studentId: string;
  fullName: string;
  attendanceRate: number;
  averagePercentage: number;
}

export default function ReportsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canViewReports = can(PERMISSIONS.REPORTS_VIEW);
  const canViewAnalytics = can(PERMISSIONS.ANALYTICS_READ);
  const [correlationBatchId, setCorrelationBatchId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: [...queryKeys.reportsOverview, scopeKey],
    queryFn: () =>
      apiClient<ReportsOverviewResponse>(withBranchScope('/reports/overview', effectiveScope), {
        token,
      }),
    enabled: !!token && canViewReports,
  });

  const { data: defaulters, isLoading: defaultersLoading } = useQuery({
    queryKey: queryKeys.reportsFeeDefaulters({ scopeKey, page, limit }),
    queryFn: () =>
      apiClient<PaginatedResponse<FeeDefaulter>>(
        withBranchScope('/reports/fee-defaulters', effectiveScope, { page, limit }),
        { token },
      ),
    enabled: !!token && canViewReports,
    placeholderData: (previous) => previous,
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
        <PageHeader icon={FileBarChart} title="Reports" description="Institutional reports and exports" />
        <p className="text-sm text-[var(--text-sub-500)]">You do not have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={FileBarChart}
        title="Reports"
        description="Overview, fee collection, and performance insights"
      />

      <div className="flex justify-end">
        <PageBranchScopeControl />
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

      <ContentPanel
        title={`Fee defaulters (${defaulters?.meta.total ?? 0})`}
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={!defaulters?.data.length}
            onClick={() =>
              downloadCsv(
                'fee-defaulters.csv',
                ['Student', 'Phone', 'Fee type', 'Amount', 'Due date'],
                (defaulters?.data ?? []).map((inv) => [
                  inv.student.fullName,
                  inv.student.phone ?? '',
                  inv.feeType?.name ?? '',
                  inv.netAmount,
                  inv.dueDate ?? '',
                ]),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Student</th>
                <th className={thClass}>Phone</th>
                <th className={thClass}>Fee type</th>
                <th className={thClass}>Amount</th>
                <th className={thClass}>Due date</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {defaultersLoading ? (
                <DataTableSkeletonRows columns={5} rows={limit} />
              ) : defaulters?.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                    No overdue invoices
                  </td>
                </tr>
              ) : (
                defaulters?.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--neutral-50)]/50">
                    <td className={tdClass}>{inv.student.fullName}</td>
                    <td className={tdClass}>{inv.student.phone ?? '—'}</td>
                    <td className={tdClass}>{inv.feeType?.name ?? 'Fee'}</td>
                    <td className={tdClass}>{formatCurrency(inv.netAmount)}</td>
                    <td className={tdClass}>{inv.dueDate ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {defaulters?.meta && (
          <PaginationBar
            page={page}
            totalPages={defaulters.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </ContentPanel>

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
                      <tr key={s.studentId} className="hover:bg-[var(--neutral-50)]/50">
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
