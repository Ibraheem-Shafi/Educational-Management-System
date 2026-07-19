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
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { PortalAttendanceSection } from '@/components/portal/portal-attendance-section';

export default function StudentAttendancePage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const params = { page, limit };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalStudentAttendance(params),
    queryFn: () =>
      apiClient<PortalAttendanceResponse>(`/portal/student/attendance${buildPortalQuery(params)}`, {
        token,
      }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load attendance.</p>;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={ClipboardCheck} title="Attendance" description="Recent attendance records" />
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
    </div>
  );
}
