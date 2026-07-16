'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import type { PortalAttendanceResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import { PageHeader } from '@/components/layout/page-header';
import { PortalAttendanceSection } from '@/components/portal/portal-attendance-section';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';

export default function ParentAttendancePage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={ClipboardCheck} title="Attendance" description="View your child's attendance records" />
      <PortalParentPageShell>
        {({ childId }) => <ParentAttendanceContent childId={childId} />}
      </PortalParentPageShell>
    </div>
  );
}

function ParentAttendanceContent({ childId }: { childId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const params = { page, limit, studentId: childId };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalParentAttendance(params),
    queryFn: () =>
      apiClient<PortalAttendanceResponse>(`/portal/parent/attendance${buildPortalQuery(params)}`, {
        token,
      }),
    enabled: !!token && !!childId,
  });

  if (isLoading && !data) return <p className="text-sm text-[var(--text-sub-500)]">Loading…</p>;
  if (error) return <p className="text-red-600">Unable to load attendance.</p>;

  return (
    <PortalAttendanceSection
      records={data?.records.data ?? []}
      summary={data?.summary}
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
