'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { formatCurrency, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { withBranchScope } from '@/lib/branch-scope';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { usePermissions } from '@/hooks/use-permissions';
import type { PaginatedResponse } from '@eims/types';
import { SearchInput } from '@/components/layout/search-input';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { FilterBar } from '@/components/layout/filter-bar';
import { UserAvatar } from '@/components/layout/user-avatar';
import { cn } from '@/lib/utils';
import {
  EditChallanDialog,
  type EditableChallan,
} from '@/components/features/fees/edit-challan-dialog';

interface ChallanRow extends EditableChallan {
  monthLabel: string;
  status: string;
  grandTotal: number;
  dueAmount: number;
  student?: {
    fullName: string;
    admissionNumber: string | null;
    className: string | null;
  } | null;
}

export function FeeChallansPanel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const { can } = usePermissions();
  const canCollect = can(PERMISSIONS.FEES_COLLECT);
  const { effectiveScope } = useEffectiveBranchScope();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [editChallan, setEditChallan] = useState<EditableChallan | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search.trim()) params.set('search', search.trim());
    if (billingPeriod.trim()) params.set('billingPeriod', billingPeriod.trim());
    return withBranchScope(`/fee-challans?${params}`, effectiveScope);
  }, [page, limit, search, billingPeriod, effectiveScope]);

  const { data, isLoading } = useQuery({
    queryKey: ['fee-challans', query],
    queryFn: () => apiClient<PaginatedResponse<ChallanRow>>(query, { token }),
    enabled: !!token,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput
          value={search}
          onValueChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search student / challan / En. No."
        />
        <input
          type="month"
          value={billingPeriod}
          onChange={(e) => {
            setBillingPeriod(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 text-sm"
          aria-label="Billing period"
        />
      </FilterBar>

      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Challan</th>
              <th className={dataTableThClass}>Student</th>
              <th className={dataTableThClass}>Class</th>
              <th className={dataTableThClass}>Month</th>
              <th className={dataTableThClass}>Status</th>
              <th className={`${dataTableThClass} text-right`}>Total</th>
              <th className={`${dataTableThClass} text-right`}>Due</th>
              <th className={dataTableThClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <DataTableSkeletonRows columns={8} rows={8} />
            ) : rows.length === 0 ? (
              <tr>
                <td className={dataTableTdClass} colSpan={8}>
                  No challans yet. Import the Shahwali register or create challans for a billing month.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn('transition-colors', statusRowClass(row.status, row.status))}
                >
                  <td className={dataTableTdClass}>{row.challanNo ?? '—'}</td>
                  <td className={dataTableTdClass}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar name={row.student?.fullName} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.student?.fullName ?? '—'}</div>
                        <div className="text-xs text-text-sub-500">{row.student?.admissionNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td className={dataTableTdClass}>{row.student?.className ?? '—'}</td>
                  <td className={dataTableTdClass}>{row.monthLabel}</td>
                  <td className={dataTableTdClass}>
                    <StatusBadge
                      label={row.status}
                      code={
                        row.status === 'paid'
                          ? 'paid'
                          : row.status === 'partial'
                            ? 'partial'
                            : 'pending'
                      }
                    />
                  </td>
                  <td className={`${dataTableTdClass} text-right`}>
                    {formatCurrency(row.grandTotal)}
                  </td>
                  <td
                    className={cn(
                      dataTableTdClass,
                      'text-right font-semibold',
                      row.dueAmount > 0
                        ? 'text-[var(--palette-coral)]'
                        : 'text-[var(--palette-green)]',
                    )}
                  >
                    {formatCurrency(row.dueAmount)}
                  </td>
                  <td className={dataTableTdClass}>
                    <RowActionsMenu
                      items={[
                        {
                          label: 'Print',
                          onClick: () => window.open(`/print/challans/${row.id}`, '_blank'),
                        },
                        ...(canCollect
                          ? [
                              {
                                label: 'Edit',
                                onClick: () => setEditChallan(row),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta ? (
        <PaginationBar
          page={meta.page}
          totalPages={meta.totalPages}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      ) : null}

      <EditChallanDialog
        open={!!editChallan}
        onOpenChange={(next) => {
          if (!next) setEditChallan(null);
        }}
        challan={editChallan}
      />
    </div>
  );
}
