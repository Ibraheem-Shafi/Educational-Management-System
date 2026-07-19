import type { PaginatedResponse } from '@eims/types';
import { PageHeader } from '@/components/layout/page-header';
import { getServerAccessToken } from '@/lib/server-session';
import { serverApiClient } from '@/lib/server-api';
import { AuditList, type AuditRow } from './audit-list';

export default async function AuditPage() {
  const token = await getServerAccessToken();
  let initialPage: PaginatedResponse<AuditRow> | undefined;

  if (token) {
    try {
      initialPage = await serverApiClient<PaginatedResponse<AuditRow>>(
        '/audit-logs?page=1&limit=8',
        token,
      );
    } catch {
      initialPage = undefined;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit logs" description="System activity trail" />
      <AuditList initialPage={initialPage} />
    </div>
  );
}
