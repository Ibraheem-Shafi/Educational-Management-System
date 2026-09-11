'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { payrollPaymentMethods, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import type { PayrollRunSummary } from './types';
import { formatLabel, formatPeriod, historyStatusLabel } from './types';

export function HistoryPanel({
  branchId,
  onViewRun,
}: {
  branchId: string;
  onViewRun: (runId: string) => void;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [payRun, setPayRun] = useState<PayrollRunSummary | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<(typeof payrollPaymentMethods)[number]>('cash');

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = { branchId, status: 'finalized', page, limit };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payrollHistory(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        status: 'finalized',
        page: String(page),
        limit: String(limit),
      });
      return apiClient<PaginatedResponse<PayrollRunSummary>>(
        `/payroll/runs?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const rows = data?.data ?? [];

  const markPaid = useMutation({
    mutationFn: (runId: string) =>
      apiClient(`/payroll/runs/${runId}/mark-paid`, {
        method: 'POST',
        token,
        body: JSON.stringify({ paymentMethod }),
      }),
    onSuccess: async () => {
      toast.success('Marked as paid');
      setPayRun(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollHistory(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleExport = async (runId: string) => {
    try {
      const data = await apiClient<{ csv: string; filename: string }>(
        `/payroll/runs/${runId}/export?format=csv`,
        { token },
      );
      const blob = new Blob([data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <>
    <ContentPanel title={`Payment history (${data?.meta.total ?? 0})`}>
      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Period</th>
              <th className={dataTableThClass}>Status</th>
              <th className={dataTableThClass}>Lines</th>
              <th className={dataTableThClass}>Finalized</th>
              <th className={dataTableThClass}>Paid</th>
              <th className={dataTableThClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <DataTableSkeletonRows columns={6} rows={limit} />
            ) : error ? (
              <tr>
                <td colSpan={6} className={dataTableTdClass}>
                  <p className="text-sm text-red-600">Unable to load history</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={dataTableTdClass}>
                  <p className="text-sm text-[var(--text-sub-500)]">No finalized payroll runs yet</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status = historyStatusLabel(row);
                return (
                <tr
                  key={row.id}
                  className={statusRowClass(status.code, status.label)}
                >
                  <td className={dataTableTdClass}>
                    <span className="font-medium">{formatPeriod(row.year, row.month)}</span>
                  </td>
                  <td className={dataTableTdClass}>
                    <StatusBadge
                      label={status.label}
                      code={status.code}
                    />
                  </td>
                  <td className={dataTableTdClass}>{row.lineCount ?? '—'}</td>
                  <td className={dataTableTdClass}>
                    {row.finalizedAt
                      ? new Date(row.finalizedAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className={dataTableTdClass}>
                    {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : '—'}
                  </td>
                  <td className={dataTableTdClass}>
                    <RowActionsMenu
                      items={[
                        {
                          label: 'View',
                          onClick: () => onViewRun(row.id),
                        },
                        {
                          label: 'Export',
                          onClick: () => handleExport(row.id),
                        },
                        ...(canManage && !row.paidAt
                          ? [
                              {
                                label: 'Mark as paid',
                                onClick: () => setPayRun(row),
                              },
                            ]
                          : []),
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
    <ConfirmDialog
      open={!!payRun}
      onOpenChange={(open) => !open && setPayRun(null)}
      title="Mark this run as paid?"
      description={
        payRun
          ? `Record payment for ${formatPeriod(payRun.year, payRun.month)}.`
          : 'Record that staff have been paid for this month.'
      }
      confirmLabel="Mark as paid"
      loading={markPaid.isPending}
      onConfirm={() => payRun && markPaid.mutate(payRun.id)}
    >
      <SelectDropdown
        aria-label="Payment method"
        fullWidth
        value={paymentMethod}
        onValueChange={(value) =>
          setPaymentMethod(value as (typeof payrollPaymentMethods)[number])
        }
        options={payrollPaymentMethods.map((method) => ({
          value: method,
          label: formatLabel(method),
        }))}
        className="w-full"
      />
    </ConfirmDialog>
    </>
  );
}
