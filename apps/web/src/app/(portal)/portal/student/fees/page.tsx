'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import type { PortalFeesResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import { PageHeader } from '@/components/layout/page-header';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { PortalFeesSection } from '@/components/portal/portal-fees-section';

export default function StudentFeesPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const params = { page, limit };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalStudentFees(params),
    queryFn: () =>
      apiClient<PortalFeesResponse>(`/portal/student/fees${buildPortalQuery(params)}`, { token }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load fees.</p>;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={Wallet} title="Fees" description="Invoices and outstanding balance" />
      <PortalFeesSection
        outstanding={data?.outstanding ?? 0}
        invoices={data?.invoices.data ?? []}
        page={data?.invoices.meta.page}
        totalPages={data?.invoices.meta.totalPages}
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
