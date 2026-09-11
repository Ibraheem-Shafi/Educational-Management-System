'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LIBRARY_MAX_RENEWALS, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [issueOpen, setIssueOpen] = useState(false);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    activeOnly: activeOnly === 'true',
    ...(activeOnly === 'overdue' ? { activeOnly: true, overdueOnly: true } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.libraryLoans(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (activeOnly === 'overdue') {
        params.set('activeOnly', 'true');
        params.set('overdueOnly', 'true');
      } else if (activeOnly === 'true') {
        params.set('activeOnly', 'true');
      }
      return apiClient<PaginatedResponse<LibraryLoan>>(`/library/loans?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
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
        title={`Loans (${data?.meta.total ?? 0})`}
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
              onValueChange={(next) => {
                setActiveOnly(next);
                setPage(1);
              }}
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
          <>
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
                    <DataTableSkeletonRows columns={canManage ? 7 : 6} rows={limit} />
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
                      <tr
                        key={loan.id}
                        className={statusRowClass(
                          overdue && !loan.returnedAt
                            ? 'overdue'
                            : loan.returnedAt
                              ? 'paid'
                              : 'pending',
                          overdue && !loan.returnedAt
                            ? 'Overdue'
                            : loan.returnedAt
                              ? 'Returned'
                              : 'Issued',
                        )}
                      >
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
                              <RowActionsMenu
                                items={[
                                  ...(loan.renewedCount < LIBRARY_MAX_RENEWALS
                                    ? [
                                        {
                                          label: 'Renew',
                                          onClick: () => renewLoan.mutate(loan.id),
                                        },
                                      ]
                                    : []),
                                  {
                                    label: 'Return',
                                    onClick: () => returnLoan.mutate(loan.id),
                                  },
                                ]}
                              />
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
            {data && (
              <PaginationBar
                page={page}
                totalPages={data.meta.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
              />
            )}
          </>
        )}
      </ContentPanel>

      {issueOpen && (
        <IssueLoanDialog open={issueOpen} onOpenChange={setIssueOpen} branchId={branchId} />
      )}
    </>
  );
}
