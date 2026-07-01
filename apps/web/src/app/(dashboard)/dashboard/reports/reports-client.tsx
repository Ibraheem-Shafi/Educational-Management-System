'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { useBatches } from '@/hooks/use-batches';
import { downloadCsv } from '@/lib/download-csv';
import { formatCurrency } from '@eims/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { FilterBar, filterSelectClass } from '@/components/layout/filter-bar';
import { ListRow } from '@/components/layout/list-row';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

interface Overview {
  students: { total: number };
  fees: {
    pendingCount: number;
    paidCount: number;
    pendingAmount: number;
    collectedAmount: number;
  };
  attendanceMarkedToday: number;
  parents: number;
  staffUsers: number;
}

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
  const { session, user } = useAuth();
  const token = session?.access_token;
  const canViewReports = user?.permissions.includes('reports.view');
  const canViewAnalytics = user?.permissions.includes('analytics.read');
  const [correlationBatchId, setCorrelationBatchId] = useState('');

  const { effectiveBranchId } = useEffectiveBranchId(token, user?.branchId);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: queryKeys.reportsOverview,
    queryFn: () => apiClient<Overview>('/reports/overview', { token }),
    enabled: !!token && canViewReports,
  });

  const { data: defaulters, isLoading: defaultersLoading } = useQuery({
    queryKey: ['reports-fee-defaulters'],
    queryFn: () =>
      apiClient<{ data: FeeDefaulter[]; total: number }>('/reports/fee-defaulters', { token }),
    enabled: !!token && canViewReports,
  });

  const { data: batches } = useBatches(token, effectiveBranchId, undefined, !!canViewAnalytics);

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

  const maxCorrelationPct = Math.max(
    ...topCorrelationStudents.map((s) => s.averagePercentage),
    1,
  );

  if (!canViewReports) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Institutional reports and exports" />
        <p className="text-muted-foreground">You do not have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Overview, fee collection, and performance insights" />

      {overviewLoading && <p className="text-muted-foreground">Loading overview...</p>}

      {overview && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Students</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overview.students.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Parents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overview.parents}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Staff users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overview.staffUsers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Attendance today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{overview.attendanceMarkedToday}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Collection summary</CardTitle>
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
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Collected</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(overview.fees.collectedAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {overview.fees.paidCount} paid invoices
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(overview.fees.pendingAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {overview.fees.pendingCount} unpaid invoices
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Collection rate</p>
                  <p className="text-xl font-semibold">{collectionRate ?? '—'}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total billed</p>
                  <p className="text-xl font-semibold">
                    {formatCurrency(
                      overview.fees.collectedAmount + overview.fees.pendingAmount,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Fee defaulters ({defaulters?.total ?? 0})</CardTitle>
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
        </CardHeader>
        <CardContent>
          {defaultersLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {defaulters?.data.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">No overdue invoices</p>
            )}
            {defaulters?.data.map((inv) => (
              <ListRow key={inv.id}>
                <p className="font-medium">{inv.student.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {inv.feeType?.name ?? 'Fee'} · Due {inv.dueDate ?? '—'} ·{' '}
                  {formatCurrency(inv.netAmount)}
                </p>
              </ListRow>
            ))}
          </div>
        </CardContent>
      </Card>

      {canViewAnalytics && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance vs performance correlation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar>
              <select
                className={filterSelectClass}
                value={correlationBatchId}
                onChange={(e) => setCorrelationBatchId(e.target.value)}
              >
                <option value="">All batches</option>
                {batches?.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
            </FilterBar>

            {correlationLoading && <ListLoadingSkeleton />}

            {correlation && (
              <>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Period: </span>
                    <span className="font-medium">{correlation.periodDays} days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pearson correlation: </span>
                    <span className="font-medium">
                      {correlation.correlation != null ? correlation.correlation : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Students with data: </span>
                    <span className="font-medium">{correlation.students.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {topCorrelationStudents.map((s) => (
                      <div key={s.studentId} className="flex items-center gap-3 text-sm">
                        <span className="hidden w-40 shrink-0 truncate sm:inline">{s.fullName}</span>
                        <span className="w-24 shrink-0 text-muted-foreground sm:hidden">
                          {s.fullName.split(' ')[0]}
                        </span>
                        <div className="h-3 flex-1 rounded-full bg-muted">
                          <div
                            className="h-3 rounded-full bg-[var(--institution-primary)]"
                            style={{
                              width: `${(s.averagePercentage / maxCorrelationPct) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-28 shrink-0 text-right text-muted-foreground">
                          {s.attendanceRate}% att · {s.averagePercentage}% perf
                        </span>
                      </div>
                    ))}
                  {correlation.students.length === 0 && (
                    <p className="text-muted-foreground">
                      Not enough attendance and assessment data to show correlation
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
