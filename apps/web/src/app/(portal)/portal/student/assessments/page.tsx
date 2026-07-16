'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import type { PortalAssessmentsResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { PortalAssessmentsSection } from '@/components/portal/portal-assessments-section';

export default function StudentAssessmentsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const params = { page, limit };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalStudentAssessments(params),
    queryFn: () =>
      apiClient<PortalAssessmentsResponse>(`/portal/student/assessments${buildPortalQuery(params)}`, {
        token,
      }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load assessments.</p>;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={FileText} title="Assessments" description="Your recent grades" />
      <PortalAssessmentsSection
        assessments={data?.records.data ?? []}
        averagePercentage={data?.averagePercentage}
        bySubject={data?.bySubject}
        chartGradientId="studentAssessmentsTrend"
        page={data?.records.meta.page}
        totalPages={data?.records.meta.totalPages}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
      />
    </div>
  );
}
