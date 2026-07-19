'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Download, Play, Send, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
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
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { CreateRunDialog } from './create-run-dialog';
import { AdjustLineDialog } from './adjust-line-dialog';
import type { PayrollLine, PayrollRunDetail, PayrollRunSummary } from './types';
import { formatLabel, formatPeriod, statusBadgeCode } from './types';

function RunActions({
  branchId,
  run,
  onRefresh,
}: {
  branchId: string;
  run: PayrollRunSummary;
  onRefresh: () => void;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);
  const canApprove = can(PERMISSIONS.PAYROLL_APPROVE);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRun(run.id) });
    onRefresh();
  };

  const generate = useMutation({
    mutationFn: () => apiClient(`/payroll/runs/${run.id}/generate`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Payroll lines generated');
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiClient(`/payroll/runs/${run.id}/submit-approval`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Submitted for approval');
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approve = useMutation({
    mutationFn: () => apiClient(`/payroll/runs/${run.id}/approve`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Payroll approved');
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const finalize = useMutation({
    mutationFn: () => apiClient(`/payroll/runs/${run.id}/finalize`, { method: 'POST', token }),
    onSuccess: async () => {
      toast.success('Payroll finalized');
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportCsv = useMutation({
    mutationFn: () =>
      apiClient<{ csv: string; filename: string }>(
        `/payroll/runs/${run.id}/export?format=csv`,
        { token },
      ),
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      {canManage && run.status === 'draft' && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Generate
        </Button>
      )}
      {canManage && run.status === 'draft' && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Submit
        </Button>
      )}
      {canApprove && run.status === 'pending_approval' && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={approve.isPending}
          onClick={() => approve.mutate()}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Approve
        </Button>
      )}
      {canApprove && run.status === 'approved' && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={finalize.isPending}
          onClick={() => finalize.mutate()}
        >
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          Finalize
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={exportCsv.isPending}
        onClick={() => exportCsv.mutate()}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Export CSV
      </Button>
    </div>
  );
}

function RunDetail({
  branchId,
  runId,
}: {
  branchId: string;
  runId: string;
}) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canManage = can(PERMISSIONS.PAYROLL_MANAGE);
  const [adjustLine, setAdjustLine] = useState<PayrollLine | null>(null);
  const [, setTick] = useState(0);

  const { data: run, isLoading } = useQuery({
    queryKey: queryKeys.payrollRun(runId),
    queryFn: () => apiClient<PayrollRunDetail>(`/payroll/runs/${runId}`, { token }),
    enabled: !!token && !!runId,
  });

  if (isLoading || !run) {
    return (
      <ContentPanel title="Run details">
        <div className="p-5">
          <DataTableSkeletonRows columns={6} rows={4} />
        </div>
      </ContentPanel>
    );
  }

  const totalNet = run.lines.reduce((sum, line) => sum + line.netPay, 0);

  return (
    <>
      <ContentPanel
        title={`${formatPeriod(run.year, run.month)} — ${formatLabel(run.status)}`}
        actions={
          <StatusBadge label={formatLabel(run.status)} code={statusBadgeCode(run.status)} />
        }
      >
        <div className="space-y-4 border-b border-stroke-soft-200 px-5 py-4">
          <RunActions branchId={branchId} run={run} onRefresh={() => setTick((t) => t + 1)} />
          <p className="text-sm text-[var(--text-sub-500)]">
            {run.lines.length} staff · Total net {formatCurrency(totalNet)}
            {run.notes ? ` · ${run.notes}` : ''}
          </p>
        </div>

        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Staff</th>
                <th className={dataTableThClass}>Basic</th>
                <th className={dataTableThClass}>Allowances</th>
                <th className={dataTableThClass}>Deductions</th>
                <th className={dataTableThClass}>Adjustments</th>
                <th className={dataTableThClass}>Net pay</th>
                <th className={dataTableThClass}>Attendance</th>
                <th className={dataTableThClass}>Slip</th>
                {canManage && run.status === 'draft' && (
                  <th className={dataTableThClass}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {run.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage && run.status === 'draft' ? 9 : 8}
                    className={dataTableTdClass}
                  >
                    <p className="text-sm text-[var(--text-sub-500)]">
                      No lines yet — generate from active salary structures
                    </p>
                  </td>
                </tr>
              ) : (
                run.lines.map((line) => (
                  <tr key={line.id} className={dataTableRowHoverClass}>
                    <td className={dataTableTdClass}>
                      <p className="font-medium">{line.user?.fullName}</p>
                      <p className="text-xs text-[var(--text-sub-500)]">{line.user?.staffCode}</p>
                    </td>
                    <td className={dataTableTdClass}>{formatCurrency(line.basicSalary)}</td>
                    <td className={dataTableTdClass}>{formatCurrency(line.allowancesTotal)}</td>
                    <td className={dataTableTdClass}>{formatCurrency(line.deductionsTotal)}</td>
                    <td className={dataTableTdClass}>{formatCurrency(line.adjustmentsTotal)}</td>
                    <td className={dataTableTdClass}>{formatCurrency(line.netPay)}</td>
                    <td className={dataTableTdClass}>
                      {line.attendancePresentDays}/{line.workingDays}
                      <span className="text-xs text-[var(--text-sub-500)]">
                        {' '}
                        ({line.attendanceAbsentDays} absent)
                      </span>
                    </td>
                    <td className={dataTableTdClass}>
                      <Link
                        href={`/print/salary-slips/${line.id}`}
                        target="_blank"
                        className="text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
                      >
                        Print
                      </Link>
                    </td>
                    {canManage && run.status === 'draft' && (
                      <td className={dataTableTdClass}>
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Adjust',
                              onClick: () => setAdjustLine(line),
                            },
                          ]}
                        />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentPanel>

      <AdjustLineDialog
        branchId={branchId}
        line={adjustLine}
        open={!!adjustLine}
        onOpenChange={(open) => !open && setAdjustLine(null)}
      />
    </>
  );
}

export function RunsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = { branchId, page, limit, excludeFinalized: true };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payrollRuns(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
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
    select: (res) => ({
      ...res,
      data: res.data.filter((r) => r.status !== 'finalized'),
    }),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <ContentPanel
        title={`Active runs (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.PAYROLL_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New run
            </button>
          </PermissionGate>
        }
      >
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Period</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Lines</th>
                <th className={dataTableThClass}>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <DataTableSkeletonRows columns={4} rows={limit} />
              ) : error ? (
                <tr>
                  <td colSpan={4} className={dataTableTdClass}>
                    <p className="text-sm text-red-600">Unable to load runs</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className={dataTableTdClass}>
                    <p className="text-sm text-[var(--text-sub-500)]">No active payroll runs</p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={dataTableRowHoverClass}
                    onClick={() => setSelectedRunId(row.id)}
                  >
                    <td className={dataTableTdClass}>
                      <button
                        type="button"
                        className="font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
                        onClick={() => setSelectedRunId(row.id)}
                      >
                        {formatPeriod(row.year, row.month)}
                      </button>
                    </td>
                    <td className={dataTableTdClass}>
                      <StatusBadge
                        label={formatLabel(row.status)}
                        code={statusBadgeCode(row.status)}
                      />
                    </td>
                    <td className={dataTableTdClass}>{row.lineCount ?? '—'}</td>
                    <td className={dataTableTdClass}>
                      {new Date(row.createdAt).toLocaleDateString()}
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

      {selectedRunId && <RunDetail branchId={branchId} runId={selectedRunId} />}

      <CreateRunDialog
        branchId={branchId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setSelectedRunId(id)}
      />
    </div>
  );
}
