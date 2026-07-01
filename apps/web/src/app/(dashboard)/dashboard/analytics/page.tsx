'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { downloadCsv } from '@/lib/download-csv';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { FilterBar, filterSelectClass } from '@/components/layout/filter-bar';

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
  const { session, user } = useAuth();
  const token = session?.access_token;
  const range = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [threshold, setThreshold] = useState('50');
  const [batchId, setBatchId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = user?.branchId || branches?.data[0]?.id || '';

  const { data: batches } = useQuery({
    queryKey: ['batches', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        `/batches?branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: assessments } = useQuery({
    queryKey: ['assessments', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        `/assessments${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ''}`,
        { token },
      ),
    enabled: !!token,
  });

  const { data: performance } = useQuery({
    queryKey: ['analytics-performance', batchId],
    queryFn: () =>
      apiClient<{
        students: Array<{ fullName: string; overallPercentage: number | null }>;
      }>(`/analytics/performance${batchId ? `?batchId=${batchId}` : ''}`, { token }),
    enabled: !!token,
  });

  const { data: kpis } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => apiClient<{
      assessmentsLast30Days: number;
      attendanceRateLast30Days: number;
      averageAssessmentPercentage: number | null;
    }>('/analytics/dashboard', { token }),
    enabled: !!token,
  });

  const { data: trends } = useQuery({
    queryKey: ['analytics-trends', from, to],
    queryFn: () =>
      apiClient<{ trends: Array<{ date: string; rate: number; total: number }> }>(
        `/analytics/attendance-trends?from=${from}&to=${to}`,
        { token },
      ),
    enabled: !!token,
  });

  const { data: weak } = useQuery({
    queryKey: ['analytics-weak', threshold],
    queryFn: () =>
      apiClient<{
        alerts: Array<{ fullName: string; subjectName: string; averagePercentage: number }>;
      }>(`/analytics/weak-subjects?threshold=${threshold}`, { token }),
    enabled: !!token,
  });

  const { data: rankings } = useQuery({
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

  const maxRate = Math.max(...(trends?.trends.map((t) => t.rate) ?? [100]), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Performance and attendance insights" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Avg assessment % (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis?.averageAssessmentPercentage ?? '—'}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Attendance rate (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis?.attendanceRateLast30Days ?? 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Assessments (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis?.assessmentsLast30Days ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance trends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            {trends?.trends.map((t) => (
              <div key={t.date} className="flex items-center gap-3 text-sm">
                <span className="hidden w-24 shrink-0 text-muted-foreground sm:inline">{t.date}</span>
                <div className="h-3 flex-1 rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-[var(--institution-primary)]"
                    style={{ width: `${(t.rate / maxRate) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right">{t.rate}%</span>
              </div>
            ))}
            {trends?.trends.length === 0 && (
              <p className="text-muted-foreground">No attendance data in range</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Batch performance comparison</CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className={filterSelectClass}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">All batches</option>
              {batches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="divide-y divide-border">
              {performanceRows.slice(0, 10).map((s, i) => (
                <div key={i} className="flex justify-between py-2 text-sm">
                  <span>{s.fullName}</span>
                  <span>{s.overallPercentage}%</span>
                </div>
              ))}
              {performance?.students.length === 0 && (
                <p className="text-muted-foreground">No assessment data</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weak subject alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Below</span>
              <Input
                type="number"
                className="w-20"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <span className="text-sm">%</span>
            </div>
            <div className="divide-y divide-border">
              {weak?.alerts.map((a, i) => (
                <div key={i} className="flex justify-between py-2 text-sm">
                  <span>
                    {a.fullName} · {a.subjectName}
                  </span>
                  <span className="text-red-600">{a.averagePercentage}%</span>
                </div>
              ))}
              {weak?.alerts.length === 0 && (
                <p className="text-muted-foreground">No alerts at this threshold</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top rankings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar>
              <select
                className={filterSelectClass}
                value={assessmentId}
                onChange={(e) => setAssessmentId(e.target.value)}
              >
                <option value="">All recent assessments</option>
                {assessments?.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
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
            </FilterBar>

            {rankings?.rankings.map((block) => (
              <div key={block.assessment.id ?? block.assessment.name}>
                <p className="mb-2 font-medium">{block.assessment.name}</p>
                <div className="divide-y divide-border">
                  {block.topStudents.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm">
                      <span>
                        #{s.rank} {s.fullName}
                      </span>
                      <span>{s.percentage ?? '—'}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {rankings?.rankings.length === 0 && (
              <p className="text-muted-foreground">No ranked assessments yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
