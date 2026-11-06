'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, ArrowRight, RefreshCw, Play } from 'lucide-react';
import { toast } from 'sonner';
import { isSuperAdmin, PERMISSIONS, type ImportPipelineType } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader, pageHeaderActionClassName } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import { ImportWizard } from '@/components/features/imports/import-wizard';
import { useState } from 'react';

function canResumeJob(job: { status: string; processedRows: number; totalRows: number }) {
  return (
    (job.status === 'failed' || job.status === 'cancelled') &&
    job.processedRows > 0 &&
    (job.totalRows === 0 || job.processedRows < job.totalRows)
  );
}

interface ImportJobRow {
  id: string;
  pipeline: ImportPipelineType;
  pipelineLabel: string;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  status: string;
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  percent: number;
  createdAt: string;
  finishedAt: string | null;
}

export default function ImportsPage() {
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { singleBranchId, canSelect } = useEffectiveBranchScope();
  const [wizardOpen, setWizardOpen] = useState(false);

  const canManage = can(PERMISSIONS.IMPORTS_MANAGE);
  // Super Admin: list all campuses. Principal: API forces their branch only.
  const listAllCampuses = isSuperAdmin(user?.roles ?? []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.importJobs({ scope: listAllCampuses ? 'all' : 'branch' }),
    queryFn: () =>
      apiClient<PaginatedResponse<ImportJobRow>>('/imports/jobs?page=1&limit=30', { token }),
    enabled: !!token && canManage,
    refetchInterval: (q) => {
      const rows = q.state.data?.data ?? [];
      return rows.some(
        (j) => j.status === 'running' || j.status === 'ready' || j.status === 'validating',
      )
        ? 2000
        : false;
    },
  });

  const [resumingId, setResumingId] = useState<string | null>(null);
  const resumeMutation = useMutation({
    mutationFn: (jobId: string) =>
      apiClient(`/imports/jobs/${jobId}/resume`, { method: 'POST', token }),
    onMutate: (jobId) => setResumingId(jobId),
    onSuccess: (_data, jobId) => {
      const row = data?.data.find((j) => j.id === jobId);
      toast.success(
        `Resuming from ${row?.processedRows ?? '?'} — open the job to watch progress`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.importJobs() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.importJob(jobId) });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setResumingId(null),
  });

  if (!canManage) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You do not have permission to manage data imports.
      </div>
    );
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Upload}
        title="Data import"
        description="Upload spreadsheets, map columns, and import campus data with live progress"
        actions={
          <div className="flex items-center gap-2">
            {(canSelect || singleBranchId) && <PageBranchScopeControl />}
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className="h-4 w-4 shrink-0 text-white" />
              Refresh
            </button>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setWizardOpen(true)}
              disabled={!singleBranchId}
            >
              <Plus className="h-4 w-4 shrink-0 text-white" />
              New import
            </button>
          </div>
        }
      />

      {listAllCampuses ? (
        <p className="text-sm text-muted-foreground">
          Showing import jobs for <strong>all campuses</strong>. Use the campus control above only to
          choose the target for a <strong>new</strong> import.
        </p>
      ) : null}

      {!singleBranchId ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select a single campus in the branch control before starting an import. Timetables and
          campus data are imported per campus.
        </p>
      ) : null}

      <div className={dataTableWrapperClass}>
        <table className={dataTableClass}>
          <thead>
            <tr>
              <th className={dataTableThClass}>Pipeline</th>
              {listAllCampuses ? <th className={dataTableThClass}>Campus</th> : null}
              <th className={dataTableThClass}>File</th>
              <th className={dataTableThClass}>Status</th>
              <th className={dataTableThClass}>Progress</th>
              <th className={dataTableThClass}>Rows</th>
              <th className={dataTableThClass}>Created</th>
              <th className={dataTableThClass} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <DataTableSkeletonRows columns={listAllCampuses ? 8 : 7} rows={6} />
            ) : !data?.data.length ? (
              <EmptyStateCell colSpan={listAllCampuses ? 8 : 7} title="No import jobs yet" />
            ) : (
              data.data.map((job) => (
                <tr key={job.id} className={statusRowClass(job.status)}>
                  <td className={dataTableTdClass}>
                    <div className="font-medium">{job.pipelineLabel}</div>
                    <div className="text-xs text-muted-foreground">{job.pipeline}</div>
                  </td>
                  {listAllCampuses ? (
                    <td className={dataTableTdClass}>
                      <div className="font-medium">{job.branchName ?? '—'}</div>
                      {job.branchCode ? (
                        <div className="text-xs text-muted-foreground">{job.branchCode}</div>
                      ) : null}
                    </td>
                  ) : null}
                  <td className={cn(dataTableTdClass, 'max-w-[200px] truncate')}>
                    {job.fileName ?? '—'}
                  </td>
                  <td className={dataTableTdClass}>
                    <StatusBadge label={job.status} code={job.status} />
                  </td>
                  <td className={dataTableTdClass}>
                    <div className="flex min-w-[120px] flex-col gap-1">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${job.percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {job.percent}% · {job.processedRows}/{job.totalRows}
                      </span>
                    </div>
                  </td>
                  <td className={dataTableTdClass}>
                    <span className="text-emerald-700">{job.successRows}</span>
                    {' / '}
                    <span className="text-rose-700">{job.errorRows} err</span>
                  </td>
                  <td className={dataTableTdClass}>
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className={dataTableTdClass}>
                    <div className="flex flex-wrap items-center gap-2">
                      {canResumeJob(job) ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
                          disabled={resumeMutation.isPending && resumingId === job.id}
                          onClick={() => resumeMutation.mutate(job.id)}
                        >
                          <Play className="h-3.5 w-3.5" />
                          {resumeMutation.isPending && resumingId === job.id
                            ? 'Resuming…'
                            : `Resume (${job.processedRows})`}
                        </button>
                      ) : null}
                      <Link
                        href={`/dashboard/imports/${job.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                      >
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {wizardOpen && singleBranchId && token ? (
        <ImportWizard
          branchId={singleBranchId}
          token={token}
          onClose={() => {
            setWizardOpen(false);
            void queryClient.invalidateQueries({ queryKey: queryKeys.importJobs() });
          }}
        />
      ) : null}
    </div>
  );
}
