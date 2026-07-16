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
import { PortalFeesSection } from '@/components/portal/portal-fees-section';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';

export default function ParentFeesPage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={Wallet} title="Fees" description="Invoices and outstanding balance for your child" />
      <PortalParentPageShell>
        {({ childId }) => <ParentFeesContent childId={childId} />}
      </PortalParentPageShell>
    </div>
  );
}

function ParentFeesContent({ childId }: { childId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const params = { page, limit, studentId: childId };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalParentFees(params),
    queryFn: () =>
      apiClient<PortalFeesResponse>(`/portal/parent/fees${buildPortalQuery(params)}`, { token }),
    enabled: !!token && !!childId,
  });

  if (isLoading && !data) return <p className="text-sm text-[var(--text-sub-500)]">Loading…</p>;
  if (error) return <p className="text-red-600">Unable to load fees.</p>;

  return (
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
  );
}
