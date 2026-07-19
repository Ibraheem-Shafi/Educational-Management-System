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
import { PortalAssessmentsSection } from '@/components/portal/portal-assessments-section';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';

export default function ParentAssessmentsPage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={FileText} title="Assessments" description="View your child's grades and results" />
      <PortalParentPageShell>
        {({ childId }) => <ParentAssessmentsContent childId={childId} />}
      </PortalParentPageShell>
    </div>
  );
}

function ParentAssessmentsContent({ childId }: { childId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const params = { page, limit, studentId: childId };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalParentAssessments(params),
    queryFn: () =>
      apiClient<PortalAssessmentsResponse>(`/portal/parent/assessments${buildPortalQuery(params)}`, {
        token,
      }),
    enabled: !!token && !!childId,
  });

  if (isLoading && !data) return <p className="text-sm text-[var(--text-sub-500)]">Loading…</p>;
  if (error) return <p className="text-red-600">Unable to load assessments.</p>;

  return (
    <PortalAssessmentsSection
      assessments={data?.records.data ?? []}
      averagePercentage={data?.averagePercentage}
      bySubject={data?.bySubject}
      chartGradientId={`parentAssessments-${childId}`}
      page={data?.records.meta.page}
      totalPages={data?.records.meta.totalPages}
      onPageChange={setPage}
      limit={limit}
      onLimitChange={(next) => {
        setLimit(next);
        setPage(1);
      }}
    />
  );
}
