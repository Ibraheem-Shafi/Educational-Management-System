'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import type { PayrollRunSummary } from './types';
import { formatLabel, formatPeriod, statusBadgeCode } from './types';

export function HistoryPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payrollHistory(branchId),
    queryFn: () => {
      const params = new URLSearchParams({ branchId, status: 'finalized' });
      return apiClient<{ data: PayrollRunSummary[] }>(`/payroll/runs?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
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
    <ContentPanel title={`Finalized payroll (${rows.length})`}>
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
              <DataTableSkeletonRows columns={5} />
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
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/payroll?runId=${row.id}`}
                        className="text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
                      >
                        View
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleExport(row.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ContentPanel>
  );
}
