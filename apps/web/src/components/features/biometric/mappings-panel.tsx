'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, biometricEntityTypes } from '@eims/shared';
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
import { MappingDialog } from './mapping-dialog';
import type { BiometricMapping } from './types';
import { formatLabel } from './types';

export function MappingsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.BIOMETRIC_MANAGE);

  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editMapping, setEditMapping] = useState<BiometricMapping | null>(null);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const queryParams = {
    branchId,
    ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.biometricMappings(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (entityTypeFilter) params.set('entityType', entityTypeFilter);
      if (search) params.set('search', search);
      return apiClient<{ data: BiometricMapping[] }>(`/biometric/mappings?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/biometric/mappings/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Mapping removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.biometricMappings(branchId) });
    },
    onError: () => toast.error('Unable to remove mapping'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`ID mappings (${rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.BIOMETRIC_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New mapping
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search external person ID"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Entity type filter"
              placeholder="All types"
              value={entityTypeFilter}
              onValueChange={setEntityTypeFilter}
              options={[
                { value: '', label: 'All types' },
                ...biometricEntityTypes.map((t) => ({ value: t, label: formatLabel(t) })),
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load mappings.</p>
        ) : (
          <div className={dataTableWrapperClass}>
            <table className={cn(dataTableClass, 'min-w-[960px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>External ID</th>
                  <th className={dataTableThClass}>Entity type</th>
                  <th className={dataTableThClass}>Person</th>
                  <th className={dataTableThClass}>Device</th>
                  <th className={dataTableThClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={5} rows={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No mappings found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
                      <td className={dataTableTdClass}>
                        <code className="text-xs">{row.externalPersonId}</code>
                      </td>
                      <td className={dataTableTdClass}>
                        <StatusBadge label={formatLabel(row.entityType)} code={row.entityType} />
                      </td>
                      <td className={dataTableTdClass}>
                        {row.entity?.fullName ?? row.entityId}
                      </td>
                      <td className={dataTableTdClass}>
                        {row.device ? `${row.device.name} (${row.device.deviceCode})` : '—'}
                      </td>
                      <td className={dataTableTdClass}>
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditMapping(row)}
                              aria-label="Edit mapping"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => remove.mutate(row.id)}
                              disabled={remove.isPending}
                              aria-label="Remove mapping"
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

      <MappingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={branchId}
      />
      <MappingDialog
        open={!!editMapping}
        onOpenChange={(open) => !open && setEditMapping(null)}
        branchId={branchId}
        mapping={editMapping}
      />
    </>
  );
}
