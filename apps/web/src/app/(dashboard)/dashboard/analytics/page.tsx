'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { downloadCsv } from '@/lib/download-csv';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';
import type { AnalyticsDashboardKpisResponse } from '@eims/types';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AnalyticsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const range = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [threshold, setThreshold] = useState('50');
  const [batchId, setBatchId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();
  const effectiveBranchId = singleBranchId ?? '';

  const { data: batches } = useQuery({
    queryKey: queryKeys.batches(effectiveBranchId),
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        `/batches/options?branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: assessments } = useQuery({
    queryKey: ['assessments', scopeKey],
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        withBranchScope('/assessments', effectiveScope),
        { token },
      ),
    enabled: !!token,
  });

  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ['analytics-performance', batchId],
    queryFn: () =>
      apiClient<{
        students: Array<{ fullName: string; overallPercentage: number | null }>;
      }>(`/analytics/performance${batchId ? `?batchId=${batchId}` : ''}`, { token }),
    enabled: !!token,
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: [...queryKeys.analyticsDashboard, scopeKey],
    queryFn: () =>
      apiClient<AnalyticsDashboardKpisResponse>(
        withBranchScope('/analytics/dashboard', effectiveScope),
        { token },
      ),
    enabled: !!token,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics-trends', from, to],
    queryFn: () =>
      apiClient<{ trends: Array<{ date: string; rate: number; total: number }> }>(
        `/analytics/attendance-trends?from=${from}&to=${to}`,
        { token },
      ),
    enabled: !!token,
  });

  const { data: weak, isLoading: weakLoading } = useQuery({
    queryKey: ['analytics-weak', threshold],
    queryFn: () =>
      apiClient<{
        alerts: Array<{ fullName: string; subjectName: string; averagePercentage: number }>;
      }>(`/analytics/weak-subjects?threshold=${threshold}`, { token }),
    enabled: !!token,
  });

  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ['analytics-rankings', assessmentId],
    queryFn: () =>
      apiClient<{
        rankings: Array<{
          assessment: { id: string; name: string };
          topStudents: Array<{ rank: number | null; fullName: string; percentage: number | null }>;
        }>;
      }>(`/analytics/rankings${assessmentId ? `?assessmentId=${assessmentId}` : ''}`, { token }),
    enabled: !!token,
  });

  const performanceRows = (performance?.students ?? [])
    .filter((s) => s.overallPercentage !== null)
    .sort((a, b) => (b.overallPercentage ?? 0) - (a.overallPercentage ?? 0));

  const rankingExportRows = (rankings?.rankings ?? []).flatMap((block) =>
    block.topStudents.map((s) => [
      block.assessment.name,
      s.rank ?? '',
      s.fullName,
      s.percentage ?? '',
    ]),
  );

  const trendChartData = (trends?.trends ?? []).map((t) => ({
    label: t.date.slice(5),
    value: t.rate,
  }));

  const batchOptions = [
    { value: '', label: 'All batches' },
    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];

  const assessmentOptions = [
    { value: '', label: 'All recent assessments' },
    ...(assessments?.data.map((a) => ({ value: a.id, label: a.name })) ?? []),
  ];

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Performance and attendance insights"
      />

      <div className="flex justify-end">
        <PageBranchScopeControl />
      </div>

      <MainStatsSection
        isLoading={kpisLoading}
        stats={[
          {
            label: 'Avg assessment % (30d)',
            value: kpis?.averageAssessmentPercentage.value != null
              ? `${kpis.averageAssessmentPercentage.value}%`
              : '—',
            changePercent: kpis?.averageAssessmentPercentage.changePercent,
          },
          {
            label: 'Attendance rate (30d)',
            value: `${kpis?.attendanceRateLast30Days.value ?? 0}%`,
            changePercent: kpis?.attendanceRateLast30Days.changePercent,
          },
          {
            label: 'Assessments (30d)',
            value: kpis?.assessmentsLast30Days.value ?? 0,
            changePercent: kpis?.assessmentsLast30Days.changePercent,
          },
          {
            label: 'Attendance records (30d)',
            value: kpis?.attendanceRecordsLast30Days ?? 0,
          },
        ]}
      />

      <div className="space-y-4">
        <FilterBar className="items-end">
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-xs font-medium leading-4 text-[var(--text-sub-500,#525866)]">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-xs font-medium leading-4 text-[var(--text-sub-500,#525866)]">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        </FilterBar>
        <TrendAreaChart
          title="Attendance trends"
          subtitle={`${from} – ${to}`}
          data={trendChartData}
          isLoading={trendsLoading}
          valueFormatter={(v) => `${v}%`}
          gradientId="analyticsAttendanceTrend"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentPanel
          title="Batch performance comparison"
          actions={
            <Button
              size="sm"
              variant="outline"
              disabled={performanceRows.length === 0}
              onClick={() =>
                downloadCsv(
                  'batch-performance.csv',
                  ['Student', 'Overall percentage'],
                  performanceRows.map((s) => [s.fullName, s.overallPercentage ?? '']),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          }
        >
          <div className="space-y-4 px-5 pb-5 pt-4">
            <SelectDropdown
              aria-label="Filter by batch"
              placeholder="All batches"
              value={batchId}
              onValueChange={setBatchId}
              options={batchOptions}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={thClass}>Student</th>
                    <th className={cn(thClass, 'text-right')}>Overall %</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {performanceLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={2} className={tdClass}>
                          <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                        </td>
                      </tr>
                    ))}
                  {!performanceLoading && performanceRows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                        No assessment data
                      </td>
                    </tr>
                  )}
                  {!performanceLoading &&
                    performanceRows.slice(0, 10).map((s, i) => (
                      <tr key={i} className="hover:bg-[var(--neutral-50)]/50">
                        <td className={tdClass}>{s.fullName}</td>
                        <td className={cn(tdClass, 'text-right')}>{s.overallPercentage}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </ContentPanel>

        <ContentPanel title="Weak subject alerts">
          <div className="space-y-4 px-5 pb-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-sub-500)]">Below</span>
              <Input
                type="number"
                className="w-20"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <span className="text-sm text-[var(--text-sub-500)]">%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={thClass}>Student</th>
                    <th className={thClass}>Subject</th>
                    <th className={cn(thClass, 'text-right')}>Avg %</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {weakLoading &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={3} className={tdClass}>
                          <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                        </td>
                      </tr>
                    ))}
                  {!weakLoading && (weak?.alerts.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                        No alerts at this threshold
                      </td>
                    </tr>
                  )}
                  {!weakLoading &&
                    weak?.alerts.map((a, i) => (
                      <tr key={i} className="hover:bg-[var(--neutral-50)]/50">
                        <td className={tdClass}>{a.fullName}</td>
                        <td className={tdClass}>{a.subjectName}</td>
                        <td className={cn(tdClass, 'text-right text-red-600')}>{a.averagePercentage}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </ContentPanel>

        <ContentPanel
          title="Top rankings"
          className="lg:col-span-2"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SelectDropdown
                aria-label="Filter by assessment"
                placeholder="All recent assessments"
                value={assessmentId}
                onValueChange={setAssessmentId}
                options={assessmentOptions}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={rankingExportRows.length === 0}
                onClick={() =>
                  downloadCsv(
                    'assessment-rankings.csv',
                    ['Assessment', 'Rank', 'Student', 'Percentage'],
                    rankingExportRows,
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          }
        >
          <div className="space-y-6 px-5 pb-5 pt-4">
            {rankingsLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded bg-[var(--neutral-50)]" />
                ))}
              </div>
            )}
            {!rankingsLoading && (rankings?.rankings.length ?? 0) === 0 && (
              <p className="py-4 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                No ranked assessments yet
              </p>
            )}
            {!rankingsLoading &&
              rankings?.rankings.map((block) => (
                <div key={block.assessment.id ?? block.assessment.name}>
                  <p className="mb-3 text-sm font-medium text-[var(--text-main-900)]">
                    {block.assessment.name}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px] border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th className={thClass}>Rank</th>
                          <th className={thClass}>Student</th>
                          <th className={cn(thClass, 'text-right')}>Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:last-child>td]:border-b-0">
                        {block.topStudents.slice(0, 5).map((s, i) => (
                          <tr key={i} className="hover:bg-[var(--neutral-50)]/50">
                            <td className={tdClass}>#{s.rank}</td>
                            <td className={tdClass}>{s.fullName}</td>
                            <td className={cn(tdClass, 'text-right')}>{s.percentage ?? '—'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}
