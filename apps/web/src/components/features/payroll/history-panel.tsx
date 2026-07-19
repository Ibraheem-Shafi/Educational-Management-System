'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import type { PayrollRunSummary } from './types';
import { formatLabel, formatPeriod, statusBadgeCode } from './types';

export function HistoryPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

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
    <ContentPanel title={`Finalized payroll (${data?.meta.total ?? 0})`}>
      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Period</th>
              <th className={dataTableThClass}>Status</th>
              <th className={dataTableThClass}>Lines</th>
              <th className={dataTableThClass}>Finalized</th>
              <th className={dataTableThClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <DataTableSkeletonRows columns={5} rows={limit} />
            ) : error ? (
              <tr>
                <td colSpan={5} className={dataTableTdClass}>
                  <p className="text-sm text-red-600">Unable to load history</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={dataTableTdClass}>
                  <p className="text-sm text-[var(--text-sub-500)]">No finalized payroll runs yet</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={dataTableRowHoverClass}>
                  <td className={dataTableTdClass}>
                    <span className="font-medium">{formatPeriod(row.year, row.month)}</span>
                  </td>
                  <td className={dataTableTdClass}>
                    <StatusBadge
                      label={formatLabel(row.status)}
                      code={statusBadgeCode(row.status)}
                    />
                  </td>
                  <td className={dataTableTdClass}>{row.lineCount ?? '—'}</td>
                  <td className={dataTableTdClass}>
                    {row.finalizedAt
                      ? new Date(row.finalizedAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className={dataTableTdClass}>
                    <RowActionsMenu
                      items={[
                        {
                          label: 'View',
                          href: `/dashboard/payroll?runId=${row.id}`,
                        },
                        {
                          label: 'Export',
                          onClick: () => handleExport(row.id),
                        },
                      ]}
                    />
                  </td>
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
  );
}
