'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { LIBRARY_MAX_RENEWALS, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
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
import { IssueLoanDialog } from './issue-loan-dialog';
import type { LibraryLoan } from './types';
import { borrowerName, formatDate, isOverdue, statusBadgeCode } from './types';

export function LoansPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.LIBRARY_MANAGE);

  const [activeOnly, setActiveOnly] = useState('true');
  const [issueOpen, setIssueOpen] = useState(false);

  const queryParams = {
    branchId,
    activeOnly: activeOnly === 'true',
    ...(activeOnly === 'overdue' ? { activeOnly: true, overdueOnly: true } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.libraryLoans(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (activeOnly === 'overdue') {
        params.set('activeOnly', 'true');
        params.set('overdueOnly', 'true');
      } else if (activeOnly === 'true') {
        params.set('activeOnly', 'true');
      }
      return apiClient<{ data: LibraryLoan[] }>(`/library/loans?${params.toString()}`, { token });
    },
    enabled: !!token && !!branchId,
  });

  const returnLoan = useMutation({
    mutationFn: (id: string) => apiClient(`/library/loans/${id}/return`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Book returned');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryLoans(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryBooks(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryFines(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
    },
    onError: () => toast.error('Unable to return book'),
  });

  const renewLoan = useMutation({
    mutationFn: (id: string) => apiClient(`/library/loans/${id}/renew`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Loan renewed (+7 days)');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryLoans(branchId) });
    },
    onError: (err: Error & { message?: string }) =>
      toast.error(err.message || 'Unable to renew loan'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Loans (${rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.LIBRARY_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setIssueOpen(true)}>
              <PageHeaderActionIcon />
              Issue book
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SelectDropdown
              aria-label="Loan filter"
              placeholder="Filter"
              value={activeOnly}
              onValueChange={setActiveOnly}
              options={[
                { value: 'true', label: 'Active loans' },
                { value: 'overdue', label: 'Overdue only' },
                { value: 'all', label: 'All loans' },
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load loans</p>
        ) : (
          <div className={cn(dataTableWrapperClass, 'border-0')}>
            <table className={dataTableClass}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Book</th>
                  <th className={dataTableThClass}>Copy</th>
                  <th className={dataTableThClass}>Borrower</th>
                  <th className={dataTableThClass}>Issued</th>
                  <th className={dataTableThClass}>Due</th>
                  <th className={dataTableThClass}>Renewals</th>
                  {canManage && <th className={dataTableThClass}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <DataTableSkeletonRows columns={canManage ? 7 : 6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManage ? 7 : 6}
                      className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}
                    >
                      No loans found
                    </td>
                  </tr>
                ) : (
                  rows.map((loan) => {
                    const overdue = isOverdue(loan.dueAt, loan.returnedAt);
                    return (
                      <tr key={loan.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>{loan.copy?.book?.title ?? '—'}</td>
                        <td className={dataTableTdClass}>{loan.copy?.copyCode ?? '—'}</td>
                        <td className={dataTableTdClass}>{borrowerName(loan)}</td>
                        <td className={dataTableTdClass}>{formatDate(loan.issuedAt)}</td>
                        <td className={dataTableTdClass}>
                          <div className="flex items-center gap-2">
                            {formatDate(loan.dueAt)}
                            {overdue && !loan.returnedAt && (
                              <StatusBadge code="inactive" label="Overdue" />
                            )}
                            {loan.returnedAt && (
                              <StatusBadge code="active" label="Returned" />
                            )}
                          </div>
                        </td>
                        <td className={dataTableTdClass}>
                          {loan.renewedCount}/{LIBRARY_MAX_RENEWALS}
                        </td>
                        {canManage && (
                          <td className={dataTableTdClass}>
                            {!loan.returnedAt ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--midnight-blue-950,#01366C)] hover:bg-neutral-50"
                                  disabled={
                                    renewLoan.isPending ||
                                    loan.renewedCount >= LIBRARY_MAX_RENEWALS
                                  }
                                  onClick={() => renewLoan.mutate(loan.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Renew
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                                  disabled={returnLoan.isPending}
                                  onClick={() => returnLoan.mutate(loan.id)}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  Return
                                </button>
                              </div>
                            ) : (
                              <StatusBadge code={statusBadgeCode('returned')} label="Closed" />
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      {issueOpen && (
        <IssueLoanDialog open={issueOpen} onOpenChange={setIssueOpen} branchId={branchId} />
      )}
    </>
  );
}
