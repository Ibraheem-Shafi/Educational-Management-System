'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Trash2 } from 'lucide-react';
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
import { VisitorDialog } from './visitor-dialog';
import type { Visitor } from './types';
import { formatDateTime } from './types';

export function VisitorsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.FRONT_OFFICE_MANAGE);

  const [search, setSearch] = useState('');
  const [checkedInFilter, setCheckedInFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const queryParams = {
    branchId,
    ...(search ? { search } : {}),
    ...(checkedInFilter === 'in' ? { checkedInOnly: true } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.frontOfficeVisitors(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (search) params.set('search', search);
      if (checkedInFilter === 'in') params.set('checkedInOnly', 'true');
      return apiClient<{ data: Visitor[] }>(`/visitors?${params.toString()}`, { token });
    },
    enabled: !!token && !!branchId,
  });

  const checkOut = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/visitors/${id}`, { method: 'PATCH', token, body: { checkOut: true } }),
    onSuccess: async () => {
      toast.success('Visitor checked out');
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeVisitors(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
    },
    onError: () => toast.error('Unable to check out visitor'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/visitors/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Visitor record deleted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeVisitors(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
    },
    onError: () => toast.error('Unable to delete visitor'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Visitors (${rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              Check in visitor
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search by name, phone, host"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Check-in filter"
              placeholder="All visitors"
              value={checkedInFilter}
              onValueChange={setCheckedInFilter}
              options={[
                { value: '', label: 'All visitors' },
                { value: 'in', label: 'Checked in only' },
              ]}
              className="w-full sm:w-[180px]"
            />
            {(search || checkedInFilter) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setCheckedInFilter('');
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load visitors.</p>
        ) : (
          <div className={dataTableWrapperClass}>
            <table className={cn(dataTableClass, 'min-w-[880px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Name</th>
                  <th className={dataTableThClass}>Phone</th>
                  <th className={dataTableThClass}>Purpose</th>
                  <th className={dataTableThClass}>Host</th>
                  <th className={dataTableThClass}>Check-in</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={dataTableThClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={7} rows={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No visitors found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isCheckedIn = !row.checkedOutAt;
                    return (
                      <tr key={row.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>{row.fullName}</td>
                        <td className={dataTableTdClass}>{row.phone ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.purpose ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.hostName ?? '—'}</td>
                        <td className={dataTableTdClass}>{formatDateTime(row.checkedInAt)}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge
                            label={isCheckedIn ? 'Checked in' : 'Checked out'}
                            code={isCheckedIn ? 'present' : 'inactive'}
                          />
                        </td>
                        <td className={dataTableTdClass}>
                          <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE} fallback="—">
                            <div className="flex flex-wrap items-center gap-2">
                              {isCheckedIn ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkOut.mutate(row.id)}
                                  disabled={checkOut.isPending}
                                >
                                  <LogOut className="mr-1 h-3.5 w-3.5" />
                                  Check out
                                </Button>
                              ) : null}
                              {canManage ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (window.confirm('Delete this visitor record?')) remove.mutate(row.id);
                                  }}
                                  aria-label="Delete visitor"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </PermissionGate>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      <VisitorDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
    </>
  );
}
