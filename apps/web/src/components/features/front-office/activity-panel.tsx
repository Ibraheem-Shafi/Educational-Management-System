'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { ActivityNoteDialog } from './activity-note-dialog';
import type { ReceptionActivity } from './types';
import { formatDateTime, formatLabel } from './types';

export function ActivityPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [noteOpen, setNoteOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.frontOfficeActivities(branchId),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      return apiClient<{ data: ReceptionActivity[] }>(
        `/reception/activities?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Activity log (${rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setNoteOpen(true)}>
              <PageHeaderActionIcon />
              Add note
            </button>
          </PermissionGate>
        }
      >
        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load activity log.</p>
        ) : isLoading ? (
          <div className="space-y-3 px-5 py-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-50)]"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--text-sub-500)]">No activity yet</p>
        ) : (
          <ul className="divide-y divide-[var(--stroke-soft-200,#E2E4E9)]">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-[var(--text-main-900)]">
                      {row.summary}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                      {formatLabel(row.action.replace(/\./g, ' '))}
                      {row.entityType ? ` · ${row.entityType}` : ''}
                    </p>
                  </div>
                  <time
                    className={cn(
                      'shrink-0 text-xs leading-4 text-[var(--text-sub-500)]',
                      'sm:pl-4 sm:text-right',
                    )}
                    dateTime={row.createdAt}
                  >
                    {formatDateTime(row.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ContentPanel>

      <ActivityNoteDialog open={noteOpen} onOpenChange={setNoteOpen} branchId={branchId} />
    </>
  );
}
