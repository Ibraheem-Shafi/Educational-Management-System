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
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { IssueCertificateDialog } from '@/components/features/certificates/issue-certificate-dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { seedRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { UserAvatar } from '@/components/layout/user-avatar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';

const filterDateClassName =
  'h-10 rounded-md border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 text-sm text-[var(--text-main-900,#0A0D14)]';

interface IssueRow {
  id: string;
  title: string;
  serialNo: string | null;
  issuedAt: string;
  student: { fullName: string } | null;
  template: { name: string; type: string } | null;
}

interface TemplateOption {
  id: string;
  name: string;
  type: string;
}

export default function CertificatesPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canIssue = can(PERMISSIONS.CERTIFICATES_ISSUE);
  const [issueOpen, setIssueOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [issuedFrom, setIssuedFrom] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const hasFilters = Boolean(search || templateId || issuedFrom || issuedTo);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { data: templates } = useQuery({
    queryKey: queryKeys.certificateTemplates(scopeKey),
    queryFn: () =>
      apiClient<PaginatedResponse<TemplateOption>>(
        withBranchScope('/certificates/templates', effectiveScope, { limit: 100 }),
        { token },
      ),
    enabled: !!token,
  });

  const queryParams = {
    page,
    limit,
    ...(search ? { search } : {}),
    ...(templateId ? { templateId } : {}),
    ...(issuedFrom ? { issuedFrom } : {}),
    ...(issuedTo ? { issuedTo } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.certificateIssues(scopeKey, queryParams),
    queryFn: () =>
      apiClient<PaginatedResponse<IssueRow>>(
        withBranchScope('/certificates/issues', effectiveScope, {
          page,
          limit,
          search: search || undefined,
          templateId: templateId || undefined,
          issuedFrom: issuedFrom || undefined,
          issuedTo: issuedTo || undefined,
        }),
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

      <ContentPanel title={`Issuance history (${data?.meta.total ?? 0})`}>
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar className="items-end">
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search by student, title, or serial…"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Filter by template"
              placeholder="All templates"
              value={templateId}
              onValueChange={(next) => {
                setTemplateId(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All templates' },
                ...(templates?.data.map((t) => ({ value: t.id, label: t.name })) ?? []),
              ]}
              className="w-full sm:w-[200px]"
            />
            <DateField
              label="Issued from"
              aria-label="Issued from"
              value={issuedFrom}
              confirmPast={false}
              onValueChange={(next) => {
                setIssuedFrom(next);
                setPage(1);
              }}
              className={filterDateClassName}
            />
            <DateField
              label="Issued to"
              aria-label="Issued to"
              value={issuedTo}
              confirmPast={false}
              min={issuedFrom || undefined}
              onValueChange={(next) => {
                setIssuedTo(next);
                setPage(1);
              }}
              className={filterDateClassName}
            />
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTemplateId('');
                  setIssuedFrom('');
                  setIssuedTo('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>
        </div>

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
                    <EmptyStateCell colSpan={6} title="No certificates issued yet" />
                  ) : (
                    issues.map((row, index) => (
                      <tr key={row.id} className={seedRowClass(row.id, index)}>
                        <td className={dataTableTdClass}>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={row.student?.fullName} seed={row.id} size="sm" />
                            {row.student?.fullName ?? '—'}
                          </div>
                        </td>
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
