'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@eims/types';
import { PERMISSIONS, voucherStatuses } from '@eims/shared';
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
import { VoucherDialog } from './voucher-dialog';
import type { JournalVoucher } from './types';
import { formatLabel, formatMoney } from './types';

export function VouchersPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.ACCOUNTING_MANAGE);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewVoucher, setViewVoucher] = useState<JournalVoucher | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accountingVouchers(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      return apiClient<PaginatedResponse<JournalVoucher>>(
        `/accounting/vouchers?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
  });

  const post = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/accounting/vouchers/${id}/post`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Voucher posted');
      await queryClient.invalidateQueries({ queryKey: queryRoots.accountingVouchers });
    },
    onError: () => toast.error('Unable to post voucher'),
  });

  const unpost = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/accounting/vouchers/${id}/unpost`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Voucher unposted');
      await queryClient.invalidateQueries({ queryKey: queryRoots.accountingVouchers });
    },
    onError: () => toast.error('Unable to unpost voucher'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/accounting/vouchers/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Voucher deleted');
      await queryClient.invalidateQueries({ queryKey: queryRoots.accountingVouchers });
    },
    onError: () => toast.error('Unable to delete voucher'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Vouchers (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.ACCOUNTING_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              New voucher
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search voucher no or narration"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Status filter"
              placeholder="All statuses"
              value={statusFilter}
              onValueChange={(next) => {
                setStatusFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                ...voucherStatuses.map((s) => ({ value: s, label: formatLabel(s) })),
              ]}
              className="w-full sm:w-[180px]"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load vouchers.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>No</th>
                    <th className={dataTableThClass}>Date</th>
                    <th className={dataTableThClass}>Type</th>
                    <th className={dataTableThClass}>Fee type</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={dataTableThClass}>Amount</th>
                    <th className={dataTableThClass} />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={7} rows={limit} />
                  ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${dataTableTdClass} text-center text-[var(--text-sub-500)]`}>
                      No vouchers found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const total = row.lines.reduce((sum, line) => sum + line.debit, 0);
                    const isManual = !row.sourceType || row.sourceType === 'manual';
                    return (
                      <tr key={row.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>{row.voucherNo}</td>
                        <td className={dataTableTdClass}>{row.voucherDate}</td>
                        <td className={dataTableTdClass}>{formatLabel(row.voucherType)}</td>
                        <td className={dataTableTdClass}>{row.feeType?.name ?? '—'}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge code={row.status} label={formatLabel(row.status)} />
                        </td>
                        <td className={dataTableTdClass}>PKR {formatMoney(total)}</td>
                          <td className={`${dataTableTdClass} text-right`}>
                            <RowActionsMenu
                              items={[
                                {
                                  label: 'Print',
                                  onClick: () =>
                                    window.open(`/print/accounting-vouchers/${row.id}`, '_blank'),
                                },
                                ...(canManage
                                  ? [
                                      { label: 'View', onClick: () => setViewVoucher(row) },
                                      ...(row.status === 'draft'
                                        ? [{ label: 'Post', onClick: () => post.mutate(row.id) }]
                                        : []),
                                      ...(row.status === 'draft' && isManual
                                        ? [{ label: 'Delete', onClick: () => remove.mutate(row.id) }]
                                        : []),
                                      ...(row.status === 'posted' && isManual
                                        ? [{ label: 'Unpost', onClick: () => unpost.mutate(row.id) }]
                                        : []),
                                    ]
                                  : [{ label: 'View', onClick: () => setViewVoucher(row) }]),
                              ]}
                            />
                          </td>
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

      <VoucherDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={branchId}
        mode="create"
      />

      <VoucherDialog
        open={!!viewVoucher}
        onOpenChange={(open) => {
          if (!open) setViewVoucher(null);
        }}
        branchId={branchId}
        mode="view"
        voucher={viewVoucher}
      />
    </>
  );
}
