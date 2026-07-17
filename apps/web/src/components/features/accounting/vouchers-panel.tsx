'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Eye, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, voucherStatuses, voucherTypes } from '@eims/shared';
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
  const [createOpen, setCreateOpen] = useState(false);
  const [viewVoucher, setViewVoucher] = useState<JournalVoucher | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accountingVouchers(branchId, { search, status: statusFilter }),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      return apiClient<{ data: JournalVoucher[] }>(`/accounting/vouchers?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
  });

  const post = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/accounting/vouchers/${id}/post`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Voucher posted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingVouchers(branchId) });
    },
    onError: () => toast.error('Unable to post voucher'),
  });

  const unpost = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/accounting/vouchers/${id}/unpost`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Voucher unposted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingVouchers(branchId) });
    },
    onError: () => toast.error('Unable to unpost voucher'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/accounting/vouchers/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Voucher deleted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingVouchers(branchId) });
    },
    onError: () => toast.error('Unable to delete voucher'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Vouchers (${rows.length})`}
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
              onValueChange={setSearch}
              placeholder="Search voucher no or narration"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Status filter"
              placeholder="All statuses"
              value={statusFilter}
              onValueChange={setStatusFilter}
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
          <div className={dataTableWrapperClass}>
            <table className={dataTableClass}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>No</th>
                  <th className={dataTableThClass}>Date</th>
                  <th className={dataTableThClass}>Type</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={dataTableThClass}>Amount</th>
                  {canManage ? <th className={dataTableThClass} /> : null}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <DataTableSkeletonRows columns={canManage ? 6 : 5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className={`${dataTableTdClass} text-center text-[var(--text-sub-500)]`}>
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
                        <td className={dataTableTdClass}>
                          <StatusBadge code={row.status} label={formatLabel(row.status)} />
                        </td>
                        <td className={dataTableTdClass}>PKR {formatMoney(total)}</td>
                        {canManage ? (
                          <td className={`${dataTableTdClass} text-right`}>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="View voucher"
                                onClick={() => setViewVoucher(row)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {row.status === 'draft' ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Post voucher"
                                    onClick={() => post.mutate(row.id)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  {isManual ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Delete voucher"
                                      onClick={() => remove.mutate(row.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </>
                              ) : row.status === 'posted' && isManual ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Unpost voucher"
                                  onClick={() => unpost.mutate(row.id)}
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
