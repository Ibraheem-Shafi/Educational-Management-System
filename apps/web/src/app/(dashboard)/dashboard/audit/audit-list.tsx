'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListRow } from '@/components/layout/list-row';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';

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

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () =>
      apiClient<PaginatedResponse<AuditRow>>(`/audit-logs?page=${page}&limit=20`, { token }),
    enabled: !!token,
    initialData: page === 1 ? initialPage : undefined,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity ({data?.meta.total ?? 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && !data && <ListLoadingSkeleton />}
        <div className="divide-y divide-border font-mono text-sm">
          {data?.data.map((log) => (
            <ListRow key={log.id} className="font-mono text-sm">
              <span className="break-all">{log.action}</span>
              <span className="break-all text-muted-foreground">
                {log.entityType}
                {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''} · {log.user?.fullName ?? 'system'}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </ListRow>
          ))}
        </div>
        {data && (
          <PaginationBar page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        )}
      </CardContent>
    </Card>
  );
}
