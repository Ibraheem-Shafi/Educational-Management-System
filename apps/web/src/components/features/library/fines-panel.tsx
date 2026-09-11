'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LIBRARY_FINE_PER_DAY_PKR, PERMISSIONS, libraryFineStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { cn } from '@/lib/utils';
import type { LibraryFine } from './types';
import { borrowerName, formatDate, formatLabel, statusBadgeCode } from './types';

export function FinesPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.LIBRARY_MANAGE);

  const [statusFilter, setStatusFilter] = useState('unpaid');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = { branchId, page, limit, ...(statusFilter ? { status: statusFilter } : {}) };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.libraryFines(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set('status', statusFilter);
      return apiClient<PaginatedResponse<LibraryFine>>(`/library/fines?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient(`/library/fines/${id}`, { method: 'PATCH', token, body: { status } }),
    onSuccess: async () => {
      toast.success('Fine updated');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryFines(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
    },
    onError: () => toast.error('Unable to update fine'),
  });

  const rows = data?.data ?? [];

  return (
    <ContentPanel title={`Fines (${data?.meta.total ?? 0})`}>
      <div className="border-b border-stroke-soft-200 px-5 py-4">
        <FilterBar>
          <SelectDropdown
            aria-label="Status filter"
            placeholder="All statuses"
            value={statusFilter}
            onValueChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              ...libraryFineStatuses.map((s) => ({ value: s, label: formatLabel(s) })),
            ]}
            className="w-full sm:w-[180px]"
          />
        </FilterBar>
        <p className="mt-2 text-xs text-[var(--text-sub-500)]">
          Overdue fines: PKR {LIBRARY_FINE_PER_DAY_PKR} per day
        </p>
      </div>

      {error ? (
        <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load fines</p>
      ) : (
        <>
          <div className={cn(dataTableWrapperClass, 'border-0')}>
            <table className={dataTableClass}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Borrower</th>
                  <th className={dataTableThClass}>Book</th>
                  <th className={dataTableThClass}>Amount (PKR)</th>
                  <th className={dataTableThClass}>Reason</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={dataTableThClass}>Created</th>
                  {canManage && <th className={dataTableThClass}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <DataTableSkeletonRows columns={canManage ? 7 : 6} rows={limit} />
                ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}
                  >
                    No fines
                  </td>
                </tr>
              ) : (
                rows.map((fine) => (
                  <tr
                    key={fine.id}
                    className={statusRowClass(statusBadgeCode(fine.status), formatLabel(fine.status))}
                  >
                    <td className={dataTableTdClass}>
                      {fine.loan ? borrowerName(fine.loan) : '—'}
                    </td>
                    <td className={dataTableTdClass}>
                      {fine.loan?.copy?.book?.title ?? '—'}
                    </td>
                    <td className={dataTableTdClass}>
                      {Number(fine.amount).toLocaleString('en-PK')}
                    </td>
                    <td className={dataTableTdClass}>{fine.reason ?? '—'}</td>
                    <td className={dataTableTdClass}>
                      <StatusBadge code={statusBadgeCode(fine.status)} label={formatLabel(fine.status)} />
                    </td>
                    <td className={dataTableTdClass}>{formatDate(fine.createdAt)}</td>
                    {canManage && (
                      <td className={dataTableTdClass}>
                        {fine.status === 'unpaid' ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Mark paid',
                                onClick: () =>
                                  updateStatus.mutate({ id: fine.id, status: 'paid' }),
                              },
                              {
                                label: 'Waive',
                                onClick: () =>
                                  updateStatus.mutate({ id: fine.id, status: 'waived' }),
                              },
                            ]}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          {data && (
            <PaginationBar
              page={page}
              totalPages={data.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={handleLimitChange}
            />
          )}
        </>
      )}
    </ContentPanel>
  );
}
