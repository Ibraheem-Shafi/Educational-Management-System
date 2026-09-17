'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge, activeRowClass } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
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
import { StructureDialog } from './structure-dialog';
import type { SalaryStructure } from './types';

export function StructuresPanel({
  branchId,
  userId,
}: {
  branchId: string;
  userId?: string;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editStructure, setEditStructure] = useState<SalaryStructure | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(userId ? { userId } : {}),
    ...(activeFilter ? { isActive: activeFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payrollStructures(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (userId) params.set('userId', userId);
      if (activeFilter) params.set('isActive', activeFilter);
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<SalaryStructure>>(
        `/payroll/structures?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/payroll/structures/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Salary card removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollStructures(branchId) });
    },
    onError: () => toast.error('Unable to remove structure'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Staff salary cards (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.PAYROLL_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              Add staff card
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search staff name or code"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Active filter"
              placeholder="All statuses"
              value={activeFilter}
              onValueChange={(next) => {
                setActiveFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              className="w-full sm:w-[160px]"
            />
            {(search || activeFilter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setActiveFilter('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </FilterBar>
        </div>

        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Staff</th>
                <th className={dataTableThClass}>Group</th>
                <th className={dataTableThClass}>Basic pay</th>
                <th className={dataTableThClass}>Account</th>
                <th className={dataTableThClass}>EOBI / PESSI</th>
                <th className={dataTableThClass}>Status</th>
                {canManage && <th className={cn(dataTableThClass, 'w-24')} />}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <DataTableSkeletonRows columns={canManage ? 7 : 6} rows={limit} />
              ) : error ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className={dataTableTdClass}>
                    <p className="text-sm text-red-600">Unable to load salary cards</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className={dataTableTdClass}>
                    <p className="text-sm text-[var(--text-sub-500)]">No staff salary cards yet</p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={activeRowClass(row.isActive)}>
                    <td className={dataTableTdClass}>
                      <p className="font-medium text-[var(--text-main-900)]">
                        {row.user?.fullName ?? '—'}
                      </p>
                      <p className="text-xs text-[var(--text-sub-500)]">
                        {row.user?.staffCode ?? row.userId}
                      </p>
                    </td>
                    <td className={dataTableTdClass}>
                      {row.staffGroup === 'admin'
                        ? 'Admin'
                        : row.staffGroup === 'visiting'
                          ? 'Visiting'
                          : 'Permanent'}
                    </td>
                    <td className={dataTableTdClass}>{formatCurrency(row.basicSalary)}</td>
                    <td className={dataTableTdClass}>{row.bankAccount || '—'}</td>
                    <td className={dataTableTdClass}>
                      {formatCurrency(row.eobi ?? 0)} / {formatCurrency(row.pessi ?? 0)}
                    </td>
                    <td className={dataTableTdClass}>
                      <StatusBadge
                        label={row.isActive ? 'Active' : 'Inactive'}
                        code={row.isActive ? 'active' : 'inactive'}
                      />
                    </td>
                    {canManage && (
                      <td className={dataTableTdClass}>
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Edit',
                              onClick: () => setEditStructure(row),
                            },
                            {
                              label: 'Remove',
                              onClick: () => remove.mutate(row.id),
                            },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && !error && (
          <PaginationBar
            page={page}
            totalPages={data.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={handleLimitChange}
          />
        )}
      </ContentPanel>

      <StructureDialog
        branchId={branchId}
        userId={userId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {editStructure && (
        <StructureDialog
          branchId={branchId}
          structure={editStructure}
          open={!!editStructure}
          onOpenChange={(open) => !open && setEditStructure(null)}
        />
      )}
    </>
  );
}
