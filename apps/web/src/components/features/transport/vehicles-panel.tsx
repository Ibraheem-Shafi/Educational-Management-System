'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@eims/types';
import { PERMISSIONS, transportVehicleStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { VehicleDialog } from './vehicle-dialog';
import type { TransportVehicle } from './types';
import { formatCoords, formatDateTime, formatLabel, statusBadgeCode } from './types';

export function VehiclesPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<TransportVehicle | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportVehicles(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId, page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<TransportVehicle>>(
        `/transport/vehicles?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/transport/vehicles/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Vehicle removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.transportVehicles(branchId) });
    },
    onError: () => toast.error('Unable to remove vehicle'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Vehicles (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New vehicle
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search plate, model, GPS device"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
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
                ...transportVehicleStatuses.map((s) => ({ value: s, label: formatLabel(s) })),
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load vehicles.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[960px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Plate</th>
                    <th className={dataTableThClass}>Make / model</th>
                    <th className={dataTableThClass}>Capacity</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={dataTableThClass}>GPS device</th>
                    <th className={dataTableThClass}>Last position</th>
                    <th className={dataTableThClass}>Last ping</th>
                    <th className={dataTableThClass}>Staff</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={9} rows={limit} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                        No vehicles found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className={statusRowClass(statusBadgeCode(row.status), formatLabel(row.status))}
                      >
                        <td className={dataTableTdClass}>{row.plateNumber}</td>
                        <td className={dataTableTdClass}>{row.makeModel ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.capacity ?? '—'}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge label={formatLabel(row.status)} code={statusBadgeCode(row.status)} />
                        </td>
                        <td className={dataTableTdClass}>{row.gpsDeviceId ?? '—'}</td>
                        <td className={dataTableTdClass}>{formatCoords(row.lastLat, row.lastLng)}</td>
                        <td className={dataTableTdClass}>{formatDateTime(row.lastPingAt)}</td>
                        <td className={dataTableTdClass}>
                          {(row.staffAssignments ?? [])
                            .map((a) => `${a.user?.fullName ?? 'User'} (${formatLabel(a.role)})`)
                            .join(', ') || '—'}
                        </td>
                        <td className={dataTableTdClass}>
                          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE} fallback="—">
                            <RowActionsMenu
                              items={[
                                { label: 'Edit', onClick: () => setEditVehicle(row) },
                                {
                                  label: 'Remove',
                                  onClick: () => {
                                    if (window.confirm('Remove this vehicle?')) remove.mutate(row.id);
                                  },
                                },
                              ]}
                            />
                          </PermissionGate>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data?.meta && (
              <PaginationBar
                page={page}
                totalPages={data.meta.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </ContentPanel>

      <VehicleDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <VehicleDialog
        open={Boolean(editVehicle)}
        onOpenChange={(open) => {
          if (!open) setEditVehicle(null);
        }}
        branchId={branchId}
        vehicle={editVehicle}
      />
    </>
  );
}
