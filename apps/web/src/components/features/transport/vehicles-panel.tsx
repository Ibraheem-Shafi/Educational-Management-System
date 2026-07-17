'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, transportVehicleStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import { VehicleDialog } from './vehicle-dialog';
import type { TransportVehicle } from './types';
import { formatCoords, formatDateTime, formatLabel, statusBadgeCode } from './types';

export function VehiclesPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.TRANSPORT_MANAGE);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<TransportVehicle | null>(null);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const queryParams = {
    branchId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportVehicles(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      return apiClient<{ data: TransportVehicle[] }>(`/transport/vehicles?${params.toString()}`, {
        token,
      });
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
        title={`Vehicles (${rows.length})`}
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
              onValueChange={setStatusFilter}
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
                  <DataTableSkeletonRows columns={9} rows={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No vehicles found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
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
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditVehicle(row)}
                              aria-label="Edit vehicle"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (window.confirm('Remove this vehicle?')) remove.mutate(row.id);
                              }}
                              aria-label="Remove vehicle"
                              disabled={!canManage}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
