'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

interface AtRiskStudent {
  studentId: string;
  fullName: string;
  attendanceRate: number | null;
  averagePercentage: number | null;
  reasons: string[];
  riskLevel: string;
}

interface StudentSummary {
  narrative: string;
  overallPercentage: number | null;
  recommendations: Array<{ subject: string; tip: string }>;
}

export default function AiInsightsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  }).toString();

  const { data: atRisk, isLoading } = useQuery({
    queryKey: queryKeys.aiInsightsAtRisk({ page, limit }),
    queryFn: () =>
      apiClient<PaginatedResponse<AtRiskStudent>>(`/ai-insights/at-risk?${queryParams}`, { token }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const { data: summary } = useQuery({
    queryKey: ['ai-insights-summary', selectedId],
    queryFn: () => apiClient<StudentSummary>(`/ai-insights/students/${selectedId}/summary`, { token }),
    enabled: !!token && !!selectedId,
  });

  const stats = useMemo(() => {
    const students = atRisk?.data ?? [];
    return {
      total: atRisk?.meta.total ?? students.length,
      high: students.filter((s) => s.riskLevel === 'high').length,
      medium: students.filter((s) => s.riskLevel === 'medium').length,
      lowAttendance: students.filter((s) => (s.attendanceRate ?? 100) < 75).length,
    };
  }, [atRisk?.data, atRisk?.meta.total]);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Sparkles}
        title="AI Insights"
        description="At-risk detection and performance summaries"
      />

      <MainStatsSection
        isLoading={isLoading}
        stats={[
          { label: 'At-risk students', value: stats.total },
          { label: 'High risk', value: stats.high },
          { label: 'Medium risk', value: stats.medium },
          { label: 'Low attendance', value: stats.lowAttendance },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentPanel title={`At-risk students (${stats.total})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={thClass}>Student</th>
                  <th className={thClass}>Risk</th>
                  <th className={cn(thClass, 'w-24')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={3} rows={limit} />
                ) : stats.total === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No at-risk students detected
                    </td>
                  </tr>
                ) : (
                  atRisk?.data.map((s) => (
                  <tr key={s.studentId} className="hover:bg-[var(--neutral-50)]/50">
                    <td className={tdClass}>
                      <p className="font-medium">{s.fullName}</p>
                      <p className="text-xs text-[var(--text-sub-500)]">{s.reasons.join(' · ')}</p>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge
                        label={`${s.riskLevel} risk`}
                        code={s.riskLevel === 'high' ? 'inactive' : 'pending'}
                      />
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(s.studentId)}>
                        Summary
                      </Button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {atRisk?.meta && (
            <PaginationBar
              page={page}
              totalPages={atRisk.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </ContentPanel>

        <ContentPanel title="Performance summary">
          <div className="space-y-4 px-5 py-5 text-sm">
            {!selectedId && (
              <p className="text-[var(--text-sub-500)]">Select a student to view AI summary</p>
            )}
            {summary && (
              <>
                <p className="text-[var(--text-main-900)]">{summary.narrative}</p>
                {summary.overallPercentage !== null && (
                  <p className="font-medium text-[var(--text-main-900)]">
                    Overall: {summary.overallPercentage}%
                  </p>
                )}
                {summary.recommendations.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium text-[var(--text-main-900)]">Recommendations</p>
                    <ul className="space-y-2">
                      {summary.recommendations.map((r, i) => (
                        <li key={i} className="text-[var(--text-sub-500)]">
                          <span className="font-medium text-[var(--text-main-900)]">{r.subject}:</span>{' '}
                          {r.tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}
