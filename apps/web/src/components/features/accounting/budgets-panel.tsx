'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
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
import { BudgetDialog } from './budget-dialog';
import type { Budget } from './types';
import { formatMoney } from './types';

export function BudgetsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.ACCOUNTING_MANAGE);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);

  const queryParams = { branchId, page, limit };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accountingBudgets(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      return apiClient<PaginatedResponse<Budget>>(`/accounting/budgets?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/accounting/budgets/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Budget removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingBudgets(branchId) });
    },
    onError: () => toast.error('Unable to remove budget'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Budgets (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              Add budget
            </button>
          </PermissionGate>
        }
      >
        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load budgets.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Year</th>
                    <th className={dataTableThClass}>Name</th>
                    <th className={dataTableThClass}>Lines</th>
                    <th className={dataTableThClass}>Total budget</th>
                    {canManage ? <th className={dataTableThClass} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={canManage ? 5 : 4} rows={limit} />
                  ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className={`${dataTableTdClass} text-center text-[var(--text-sub-500)]`}>
                      No budgets found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const total = row.lines.reduce((sum, line) => sum + line.amount, 0);
                    return (
                      <tr key={row.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>{row.year}</td>
                        <td className={dataTableTdClass}>{row.name}</td>
                        <td className={dataTableTdClass}>{row.lines.length}</td>
                        <td className={dataTableTdClass}>PKR {formatMoney(total)}</td>
                        {canManage ? (
                          <td className={`${dataTableTdClass} text-right`}>
                            <RowActionsMenu
                              items={[
                                { label: 'Edit', onClick: () => setEditBudget(row) },
                                { label: 'Delete', onClick: () => remove.mutate(row.id) },
                              ]}
                            />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
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

      <BudgetDialog
        open={createOpen || !!editBudget}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditBudget(null);
          }
        }}
        branchId={branchId}
        budget={editBudget}
      />
    </>
  );
}
