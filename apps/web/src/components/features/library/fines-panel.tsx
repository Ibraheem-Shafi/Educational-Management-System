'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LIBRARY_FINE_PER_DAY_PKR, PERMISSIONS, libraryFineStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
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

  const queryParams = { branchId, ...(statusFilter ? { status: statusFilter } : {}) };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.libraryFines(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (statusFilter) params.set('status', statusFilter);
      return apiClient<{ data: LibraryFine[] }>(`/library/fines?${params.toString()}`, { token });
    },
    enabled: !!token && !!branchId,
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
    <ContentPanel title={`Fines (${rows.length})`}>
      <div className="border-b border-stroke-soft-200 px-5 py-4">
        <FilterBar>
          <SelectDropdown
            aria-label="Status filter"
            placeholder="All statuses"
            value={statusFilter}
            onValueChange={setStatusFilter}
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
                <DataTableSkeletonRows columns={canManage ? 7 : 6} />
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
                  <tr key={fine.id} className={dataTableRowHoverClass}>
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
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                              onClick={() => updateStatus.mutate({ id: fine.id, status: 'paid' })}
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-xs font-medium text-[var(--text-sub-500)] hover:bg-neutral-50"
                              onClick={() => updateStatus.mutate({ id: fine.id, status: 'waived' })}
                            >
                              Waive
                            </button>
                          </div>
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
      )}
    </ContentPanel>
  );
}
