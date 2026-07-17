'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, accountTypes } from '@eims/shared';
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountingAccount | null>(null);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accountingAccounts(branchId, { search, type: typeFilter }),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      params.set('activeOnly', 'true');
      return apiClient<{ data: AccountingAccount[] }>(`/accounting/accounts?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/accounting/accounts/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Account removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts(branchId) });
    },
    onError: () => toast.error('Unable to remove account'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Chart of accounts (${rows.length})`}
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
              onValueChange={setTypeFilter}
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
                  <DataTableSkeletonRows columns={canManage ? 5 : 4} />
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
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Edit account"
                                onClick={() => setEditAccount(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Delete account"
                                onClick={() => remove.mutate(row.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
      />
    </>
  );
}
