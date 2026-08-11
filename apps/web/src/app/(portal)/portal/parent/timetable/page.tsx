'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import type { PortalTimetableResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import { PageHeader } from '@/components/layout/page-header';
import { PortalTimetableSection } from '@/components/portal/portal-timetable-section';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';

export default function ParentTimetablePage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={Calendar} title="Timetable" description="Weekly class schedule for your child" />
      <PortalParentPageShell>
        {({ childId }) => <ParentTimetableContent childId={childId} />}
      </PortalParentPageShell>
    </div>
  );
}

function ParentTimetableContent({ childId }: { childId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.portalParentTimetable(childId),
    queryFn: () =>
      apiClient<PortalTimetableResponse>(
        `/portal/parent/timetable${buildPortalQuery({ studentId: childId })}`,
        { token },
      ),
    enabled: !!token && !!childId,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;

  return (
    <PortalTimetableSection
      slots={data?.slots ?? []}
      todaySlots={data?.todaySlots ?? []}
      isError={isError}
      onRetry={() => void refetch()}
    />
  );
}
