'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { PERMISSIONS } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { queryKeys } from '@/lib/query-keys';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { SearchInput } from '@/components/layout/search-input';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { IssueCertificateDialog } from '@/components/features/certificates/issue-certificate-dialog';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';

interface IssueRow {
  id: string;
  title: string;
  serialNo: string | null;
  issuedAt: string;
  student: { fullName: string } | null;
  template: { name: string; type: string } | null;
}

export default function CertificatesPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canIssue = can(PERMISSIONS.CERTIFICATES_ISSUE);
  const [issueOpen, setIssueOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.certificateIssues(scopeKey, { page, limit, search }),
    queryFn: () =>
      apiClient<PaginatedResponse<IssueRow>>(
        withBranchScope('/certificates/issues', effectiveScope, { page, limit }),
        { token },
      ),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const issues = data?.data ?? [];

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Award}
        title="Certificates"
        description="Issue and print student certificates"
        actions={
          canIssue && singleBranchId ? (
            <button type="button" onClick={() => setIssueOpen(true)} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              Issue certificate
            </button>
          ) : undefined
        }
      />

      <div className="flex justify-end">
        <PageBranchScopeControl />
      </div>

      <ContentPanel
        title={`Issuance history (${data?.meta.total ?? 0})`}
        actions={<SearchInput value={search} onValueChange={handleSearchChange} placeholder="Search by student or title…" className="w-full sm:w-64" />}
      >
        {error ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load certificate history</p>
        ) : (
          <div className="bg-white">
            <div className={cn(dataTableWrapperClass, 'border-0')}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Title</th>
                    <th className={dataTableThClass}>Template</th>
                    <th className={dataTableThClass}>Serial</th>
                    <th className={dataTableThClass}>Issued</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={6} rows={limit} />
                  ) : issues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                        No certificates issued yet
                      </td>
                    </tr>
                  ) : (
                    issues.map((row) => (
                      <tr key={row.id} className={dataTableRowHoverClass}>
                        <td className={dataTableTdClass}>{row.student?.fullName ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.title}</td>
                        <td className={dataTableTdClass}>{row.template?.name ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.serialNo ?? '—'}</td>
                        <td className={dataTableTdClass}>
                          {new Date(row.issuedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className={dataTableTdClass}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Print',
                                href: `/print/certificates/${row.id}`,
                                target: '_blank',
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
          </div>
        )}
      </ContentPanel>

      {canIssue && singleBranchId && (
        <IssueCertificateDialog
          open={issueOpen}
          onOpenChange={setIssueOpen}
          branchId={singleBranchId}
        />
      )}
    </div>
  );
}
