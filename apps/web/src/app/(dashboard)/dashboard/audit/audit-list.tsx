'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { AuditStatsResponse, PaginatedResponse } from '@eims/types';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SearchInput } from '@/components/layout/search-input';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  user?: { fullName: string } | null;
  createdAt: string;
}

export function AuditList({
  initialPage,
}: {
  initialPage?: PaginatedResponse<AuditRow>;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) queryParams.set('action', search);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.auditStats,
    queryFn: () => apiClient<AuditStatsResponse>('/audit-logs/stats', { token }),
    enabled: !!token,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, limit, search],
    queryFn: () =>
      apiClient<PaginatedResponse<AuditRow>>(`/audit-logs?${queryParams.toString()}`, { token }),
    enabled: !!token,
    initialData: page === 1 && limit === 20 && !search ? initialPage : undefined,
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Events (24h)',
            value: stats?.eventsLast24h.total ?? 0,
            changePercent: stats?.eventsLast24h.changePercent,
          },
          {
            label: 'Events (7d)',
            value: stats?.eventsLast7d.total ?? 0,
            changePercent: stats?.eventsLast7d.changePercent,
          },
          {
            label: 'Unique actors (7d)',
            value: stats?.uniqueActors.total ?? 0,
            changePercent: stats?.uniqueActors.changePercent,
          },
          {
            label: 'Top action count (7d)',
            value: stats?.topActionCount.total ?? 0,
            changePercent: stats?.topActionCount.changePercent,
          },
        ]}
      />

      <ContentPanel title={`Recent activity (${data?.meta.total ?? 0})`}>
        <div className="space-y-4 px-5 pb-5 pt-4">
          <SearchInput
            value={search}
            onValueChange={handleSearchChange}
            placeholder="Search by action"
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={thClass}>Action</th>
                  <th className={thClass}>Entity</th>
                  <th className={thClass}>User</th>
                  <th className={thClass}>Timestamp</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading &&
                  !data &&
                  Array.from({ length: limit }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <td key={j} className={tdClass}>
                          <div className="h-4 w-20 animate-pulse rounded bg-[var(--neutral-50)]" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!isLoading && data?.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No audit logs found
                    </td>
                  </tr>
                )}

                {data?.data.map((log) => (
                  <tr key={log.id} className="font-mono hover:bg-[var(--neutral-50)]/50">
                    <td className={cn(tdClass, 'break-all')}>{log.action}</td>
                    <td className={cn(tdClass, 'break-all text-[var(--text-sub-500)]')}>
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}
                    </td>
                    <td className={tdClass}>{log.user?.fullName ?? 'system'}</td>
                    <td className={cn(tdClass, 'whitespace-nowrap text-[var(--text-sub-500)]')}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && (
            <PaginationBar
              page={page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
              limit={limit}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </div>
      </ContentPanel>
    </div>
  );
}
