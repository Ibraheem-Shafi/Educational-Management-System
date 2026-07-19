'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS, libraryReservationStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { ReservationDialog } from './reservation-dialog';
import type { LibraryReservation } from './types';
import { borrowerName, formatDate, formatLabel, statusBadgeCode } from './types';

export function ReservationsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.LIBRARY_MANAGE);

  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = { branchId, page, limit, ...(statusFilter ? { status: statusFilter } : {}) };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.libraryReservations(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set('status', statusFilter);
      return apiClient<PaginatedResponse<LibraryReservation>>(
        `/library/reservations?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/library/reservations/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Reservation cancelled');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryReservations(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
    },
    onError: () => toast.error('Unable to cancel reservation'),
  });

  const fulfill = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/library/reservations/${id}`, {
        method: 'PATCH',
        token,
        body: { status: 'fulfilled' },
      }),
    onSuccess: async () => {
      toast.success('Reservation fulfilled');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryReservations(branchId) });
    },
    onError: () => toast.error('Unable to update reservation'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Reservations (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.LIBRARY_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              New reservation
            </button>
          </PermissionGate>
        }
      >
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
                ...libraryReservationStatuses.map((s) => ({ value: s, label: formatLabel(s) })),
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load reservations</p>
        ) : (
          <>
            <div className={cn(dataTableWrapperClass, 'border-0')}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Book</th>
                    <th className={dataTableThClass}>Borrower</th>
                    <th className={dataTableThClass}>Reserved</th>
                    <th className={dataTableThClass}>Status</th>
                    {canManage && <th className={dataTableThClass}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={canManage ? 5 : 4} rows={limit} />
                  ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManage ? 5 : 4}
                      className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}
                    >
                      No reservations
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
                      <td className={dataTableTdClass}>{row.book?.title ?? '—'}</td>
                      <td className={dataTableTdClass}>{borrowerName(row)}</td>
                      <td className={dataTableTdClass}>{formatDate(row.reservedAt)}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge code={statusBadgeCode(row.status)} label={formatLabel(row.status)} />
                      </td>
                      {canManage && (
                        <td className={dataTableTdClass}>
                          {row.status === 'active' ? (
                            <RowActionsMenu
                              items={[
                                {
                                  label: 'Fulfill',
                                  onClick: () => fulfill.mutate(row.id),
                                },
                                {
                                  label: 'Cancel',
                                  onClick: () => remove.mutate(row.id),
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

      {createOpen && (
        <ReservationDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      )}
    </>
  );
}
