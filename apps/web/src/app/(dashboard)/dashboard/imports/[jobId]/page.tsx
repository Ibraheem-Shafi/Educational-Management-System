'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Play, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader, pageHeaderActionClassName } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';

interface ImportJob {
  id: string;
  pipeline: string;
  pipelineLabel: string;
  branchId: string | null;
  status: string;
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  percent: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface ImportErrorRow {
  id: string;
  rowNumber: number;
  field: string | null;
  message: string;
  code: string | null;
}

export default function ImportJobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.IMPORTS_MANAGE);

  const { data: job, isLoading } = useQuery({
    queryKey: queryKeys.importJob(jobId),
    queryFn: () => apiClient<ImportJob>(`/imports/jobs/${jobId}`, { token }),
    enabled: !!token && canManage && !!jobId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'running' || status === 'ready' || status === 'validating' ? 1500 : false;
    },
  });

  const { data: errors, isLoading: errorsLoading } = useQuery({
    queryKey: queryKeys.importJobErrors(jobId, { page: 1 }),
    queryFn: () =>
      apiClient<PaginatedResponse<ImportErrorRow>>(
        `/imports/jobs/${jobId}/errors?page=1&limit=50`,
        { token },
      ),
    enabled: !!token && canManage && !!jobId,
    refetchInterval: () => (job?.status === 'running' ? 3000 : false),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiClient(`/imports/jobs/${jobId}/cancel`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Import cancelled');
      void queryClient.invalidateQueries({ queryKey: queryKeys.importJob(jobId) });
    },
    onError: (err: Error) => {
      const msg = err.message || 'Cancel failed';
      toast.error(
        /failed to fetch|network|load failed/i.test(msg)
          ? 'API unreachable — wait for the server to finish restarting, refresh, then try Cancel again'
          : msg,
      );
    },
  });

  const canResume =
    !!job &&
    (job.status === 'failed' || job.status === 'cancelled') &&
    job.processedRows > 0 &&
    (job.totalRows === 0 || job.processedRows < job.totalRows);

  const resumeMutation = useMutation({
    mutationFn: () =>
      apiClient(`/imports/jobs/${jobId}/resume`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success(
        `Resuming from row ${job?.processedRows ?? 0} — remaining rows will be applied`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.importJob(jobId) });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canManage) {
    return <div className="p-6 text-sm text-muted-foreground">No permission.</div>;
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Upload}
        title={job?.pipelineLabel ?? 'Import job'}
        description={job?.fileName ?? jobId}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/imports" className={pageHeaderActionClassName}>
              <ArrowLeft className="h-4 w-4 shrink-0 text-white" />
              All imports
            </Link>
            {canResume ? (
              <button
                type="button"
                className={pageHeaderActionClassName}
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
              >
                <Play className="h-4 w-4 shrink-0 text-white" />
                {resumeMutation.isPending
                  ? 'Resuming…'
                  : `Resume from ${job.processedRows}/${job.totalRows || '?'}`}
              </button>
            ) : null}
            {job && (job.status === 'running' || job.status === 'ready') ? (
              <button
                type="button"
                className={pageHeaderActionClassName}
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 shrink-0 text-white" />
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={async () => {
                try {
                  const base =
                    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
                    'http://localhost:3001';
                  const res = await fetch(`${base}/imports/jobs/${jobId}/errors.csv`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) throw new Error('Could not download error CSV');
                  const text = await res.text();
                  const blob = new Blob([text], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `import-errors-${jobId}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Download failed');
                }
              }}
            >
              <Download className="h-4 w-4 shrink-0 text-white" />
              Error CSV
            </button>
          </div>
        }
      />

      {isLoading || !job ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Status" value={<StatusBadge label={job.status} code={job.status} />} />
            <StatCard label="Progress" value={`${job.percent}%`} />
            <StatCard
              label="Processed"
              value={`${job.processedRows.toLocaleString()} / ${job.totalRows.toLocaleString()}`}
            />
            <StatCard
              label="Success / Errors / Skipped"
              value={`${job.successRows} / ${job.errorRows} / ${job.skippedRows}`}
            />
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Live progress</span>
              <span className="text-muted-foreground">
                {job.startedAt ? `Started ${new Date(job.startedAt).toLocaleString()}` : 'Not started'}
                {job.finishedAt ? ` · Finished ${new Date(job.finishedAt).toLocaleString()}` : ''}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${job.percent}%` }}
              />
            </div>
            {job.lastError ? (
              <p className="mt-3 text-sm text-rose-700">{job.lastError}</p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Row errors</h2>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Row</th>
                    <th className={dataTableThClass}>Field</th>
                    <th className={dataTableThClass}>Code</th>
                    <th className={dataTableThClass}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {errorsLoading ? (
                    <DataTableSkeletonRows columns={4} rows={5} />
                  ) : !errors?.data.length ? (
                    <tr>
                      <td colSpan={4} className={dataTableTdClass}>
                        No errors logged yet.
                      </td>
                    </tr>
                  ) : (
                    errors.data.map((row) => (
                      <tr key={row.id}>
                        <td className={dataTableTdClass}>{row.rowNumber}</td>
                        <td className={dataTableTdClass}>{row.field ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.code ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
