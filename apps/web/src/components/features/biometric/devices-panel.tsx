'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
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
import { DeviceDialog } from './device-dialog';
import type { BiometricDevice } from './types';
import { formatDateTime, formatLabel, statusBadgeCode } from './types';

export function DevicesPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.BIOMETRIC_MANAGE);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<BiometricDevice | null>(null);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const queryParams = {
    branchId,
    ...(activeFilter ? { isActive: activeFilter === 'true' } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.biometricDevices(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (activeFilter) params.set('isActive', activeFilter);
      if (search) params.set('search', search);
      return apiClient<{ data: BiometricDevice[] }>(`/biometric/devices?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/biometric/devices/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Device removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.biometricDevices(branchId) });
    },
    onError: () => toast.error('Unable to remove device'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Devices (${rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.BIOMETRIC_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New device
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search name, code, location"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Active filter"
              placeholder="All devices"
              value={activeFilter}
              onValueChange={setActiveFilter}
              options={[
                { value: '', label: 'All devices' },
                { value: 'true', label: 'Active only' },
                { value: 'false', label: 'Inactive only' },
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load devices.</p>
        ) : (
          <div className={dataTableWrapperClass}>
            <table className={cn(dataTableClass, 'min-w-[960px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Name</th>
                  <th className={dataTableThClass}>Device code</th>
                  <th className={dataTableThClass}>Vendor</th>
                  <th className={dataTableThClass}>Location</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={dataTableThClass}>Last seen</th>
                  <th className={dataTableThClass}>Mappings</th>
                  <th className={dataTableThClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={8} rows={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
                      <td className={dataTableTdClass}>{row.name}</td>
                      <td className={dataTableTdClass}>
                        <code className="text-xs">{row.deviceCode}</code>
                      </td>
                      <td className={dataTableTdClass}>{formatLabel(row.vendor)}</td>
                      <td className={dataTableTdClass}>{row.location ?? '—'}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge
                          label={row.isActive ? 'Active' : 'Inactive'}
                          code={statusBadgeCode(row.isActive)}
                        />
                      </td>
                      <td className={dataTableTdClass}>{formatDateTime(row.lastSeenAt)}</td>
                      <td className={dataTableTdClass}>{row._count?.externalIds ?? 0}</td>
                      <td className={dataTableTdClass}>
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditDevice(row)}
                              aria-label="Edit device"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => remove.mutate(row.id)}
                              disabled={remove.isPending}
                              aria-label="Remove device"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      <DeviceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={branchId}
      />
      <DeviceDialog
        open={!!editDevice}
        onOpenChange={(open) => !open && setEditDevice(null)}
        branchId={branchId}
        device={editDevice}
      />
    </>
  );
}
