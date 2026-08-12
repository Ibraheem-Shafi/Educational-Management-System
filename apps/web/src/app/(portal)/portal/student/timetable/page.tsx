'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import type { PortalTimetableResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { PortalTimetableSection } from '@/components/portal/portal-timetable-section';

export default function StudentTimetablePage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.portalStudentTimetable,
    queryFn: () => apiClient<PortalTimetableResponse>('/portal/student/timetable', { token }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={Calendar} title="Timetable" description="Weekly class schedule" />
      <PortalTimetableSection
        slots={data?.slots ?? []}
        todaySlots={data?.todaySlots ?? []}
        isError={isError}
        onRetry={() => void refetch()}
      />
    </div>
  );
}
