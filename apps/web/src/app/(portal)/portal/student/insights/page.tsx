'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { PortalStudentInsightsResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';

export default function StudentInsightsPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalStudentInsights,
    queryFn: () => apiClient<PortalStudentInsightsResponse>('/portal/student/insights', { token }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load insights.</p>;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={Sparkles} title="Insights" description="AI study summary and recommendations" />

      <ContentPanel title="Performance summary">
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[var(--text-sub-500)]">{data?.narrative}</p>
          {data?.overallPercentage != null && (
            <p className="text-sm font-medium text-text-main-900">
              Overall average: {data.overallPercentage}%
            </p>
          )}
        </div>
      </ContentPanel>

      {data && data.subjects.length > 0 && (
        <ContentPanel title="Subject breakdown">
          <ul className="divide-y divide-stroke-soft-200">
            {data.subjects.map((s) => (
              <li key={s.subjectName} className="flex justify-between px-5 py-3 text-sm">
                <span>{s.subjectName}</span>
                <span className="text-[var(--text-sub-500)]">
                  {s.averagePercentage != null ? `${s.averagePercentage}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </ContentPanel>
      )}

      {data && data.recommendations.length > 0 && (
        <ContentPanel title="Recommendations">
          <ul className="space-y-2 px-5 py-4 text-sm text-[var(--text-sub-500)]">
            {data.recommendations.map((r, i) => (
              <li key={i}>
                <span className="font-medium text-text-main-900">{r.subject}:</span> {r.tip}
              </li>
            ))}
          </ul>
        </ContentPanel>
      )}
    </div>
  );
}
