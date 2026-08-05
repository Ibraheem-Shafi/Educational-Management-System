'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
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
import { RouteDialog } from './route-dialog';
import type { TransportRoute } from './types';
import { statusBadgeCode } from './types';

export function RoutesPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<TransportRoute | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = { search, page, limit };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportRoutes(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId, page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<TransportRoute>>(`/transport/routes?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/transport/routes/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Route removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.transportRoutes(branchId) });
    },
    onError: () => toast.error('Unable to remove route'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Routes (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New route
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search route name or code"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load routes.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[900px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Name</th>
                    <th className={dataTableThClass}>Code</th>
                    <th className={dataTableThClass}>Stops</th>
                    <th className={dataTableThClass}>Students</th>
                    <th className={dataTableThClass}>Trips</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={7} rows={limit} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                        No routes found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>{row.name}</td>
                        <td className={dataTableTdClass}>{row.code ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.stops?.length ?? 0}</td>
                        <td className={dataTableTdClass}>{row._count?.assignments ?? 0}</td>
                        <td className={dataTableTdClass}>{row._count?.trips ?? 0}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge
                            label={row.isActive ? 'Active' : 'Inactive'}
                            code={statusBadgeCode(row.isActive ? 'active' : 'inactive')}
                          />
                        </td>
                        <td className={dataTableTdClass}>
                          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE} fallback="—">
                            <RowActionsMenu
                              items={[
                                { label: 'Edit', onClick: () => setEditRoute(row) },
                                {
                                  label: 'Remove',
                                  onClick: () => {
                                    if (window.confirm('Remove this route?')) remove.mutate(row.id);
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

      <RouteDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <RouteDialog
        open={Boolean(editRoute)}
        onOpenChange={(open) => {
          if (!open) setEditRoute(null);
        }}
        branchId={branchId}
        route={editRoute}
      />
    </>
  );
}
