'use client';

import { useMemo } from 'react';
import { ContentPanel } from '@/components/layout/content-panel';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

interface AssessmentRecord {
  assessment: string | null;
  subject?: string | null;
  grade: string | null;
  percentage: number | null;
}

export function PortalAssessmentsSection({
  assessments,
  averagePercentage,
  bySubject = [],
  chartGradientId = 'portalAssessmentsTrend',
  page,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
}: {
  assessments: AssessmentRecord[];
  averagePercentage?: number | null;
  bySubject?: Array<{ subject: string; average: number; count: number }>;
  chartGradientId?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}) {
  const chartData = useMemo(
    () =>
      assessments
        .filter((a) => a.percentage != null)
        .slice()
        .reverse()
        .map((a, i) => ({
          label: a.assessment?.slice(0, 10) || `Test ${i + 1}`,
          value: a.percentage ?? 0,
        })),
    [assessments],
  );

  const avg =
    averagePercentage ??
    (chartData.length > 0
      ? Math.round(chartData.reduce((s, p) => s + p.value, 0) / chartData.length)
      : null);

  return (
    <div className="space-y-4">
      <TrendAreaChart
        title="Performance"
        subtitle="Assessment percentages"
        data={chartData}
        totalValue={avg != null ? `${avg}%` : undefined}
        totalLabel={avg == null ? 'No graded assessments' : undefined}
        gradientId={chartGradientId}
        valueFormatter={(v) => `${v}%`}
      />

      {bySubject.length > 0 && (
        <ContentPanel title="By subject">
          <ul className="divide-y divide-stroke-soft-200">
            {bySubject.map((s) => (
              <li key={s.subject} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-text-main-900">{s.subject}</span>
                <span className="text-[var(--text-sub-500)]">
                  {s.average}% · {s.count} tests
                </span>
              </li>
            ))}
          </ul>
        </ContentPanel>
      )}

      <ContentPanel title={`Results (${assessments.length} on this page)`}>
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[560px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Assessment</th>
                <th className={dataTableThClass}>Subject</th>
                <th className={dataTableThClass}>Grade</th>
                <th className={dataTableThClass}>Percentage</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No assessment records
                  </td>
                </tr>
              ) : (
                assessments.map((row, i) => (
                  <tr key={i}>
                    <td className={dataTableTdClass}>{row.assessment ?? 'Test'}</td>
                    <td className={dataTableTdClass}>{row.subject ?? '—'}</td>
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
        {page && totalPages && onPageChange && (
          <div className="border-t border-stroke-soft-200 px-5 py-3">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              limit={limit ?? 8}
              onLimitChange={onLimitChange ?? (() => {})}
            />
          </div>
        )}
      </ContentPanel>
    </div>
  );
}
