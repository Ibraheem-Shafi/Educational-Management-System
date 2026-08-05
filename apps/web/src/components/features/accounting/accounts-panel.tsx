'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@eims/types';
import { PERMISSIONS, accountTypes } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys, queryRoots } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
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
import { AccountDialog } from './account-dialog';
import type { AccountingAccount } from './types';
import { formatLabel } from './types';

export function AccountsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.ACCOUNTING_MANAGE);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountingAccount | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const resetListView = useCallback((saved?: AccountingAccount) => {
    setTypeFilter('');
    setPage(1);
    // Focus the list on the saved account so it isn't hidden on a later page
    // (accounts are sorted by code, 8 per page).
    setSearch(saved?.code ?? '');
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    activeOnly: true,
    ...(search ? { search } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accountingAccounts(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
        activeOnly: 'true',
      });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      return apiClient<PaginatedResponse<AccountingAccount>>(
        `/accounting/accounts?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/accounting/accounts/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Account removed');
      await queryClient.invalidateQueries({ queryKey: queryRoots.accountingAccounts });
    },
    onError: () => toast.error('Unable to remove account'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Chart of accounts (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              Add account
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search code or name"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Account type"
              placeholder="All types"
              value={typeFilter}
              onValueChange={(next) => {
                setTypeFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                ...accountTypes.map((t) => ({ value: t, label: formatLabel(t) })),
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load accounts.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Code</th>
                    <th className={dataTableThClass}>Name</th>
                    <th className={dataTableThClass}>Type</th>
                    <th className={dataTableThClass}>Scope</th>
                    {canManage ? <th className={dataTableThClass} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={canManage ? 5 : 4} rows={limit} />
                  ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className={`${dataTableTdClass} text-center text-[var(--text-sub-500)]`}>
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
                      <td className={dataTableTdClass}>{row.code}</td>
                      <td className={dataTableTdClass}>{row.name}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge code={row.type} label={formatLabel(row.type)} />
                      </td>
                      <td className={dataTableTdClass}>
                        {row.isSystem ? 'System' : row.branchId ? 'Branch' : 'Global'}
                      </td>
                      {canManage ? (
                        <td className={`${dataTableTdClass} text-right`}>
                          {!row.isSystem ? (
                            <RowActionsMenu
                              items={[
                                { label: 'Edit', onClick: () => setEditAccount(row) },
                                { label: 'Delete', onClick: () => remove.mutate(row.id) },
                              ]}
                            />
                          ) : null}
                        </td>
                      ) : null}
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

      <AccountDialog
        open={createOpen || !!editAccount}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditAccount(null);
          }
        }}
        branchId={branchId}
        account={editAccount}
        onSaved={resetListView}
      />
    </>
  );
}
