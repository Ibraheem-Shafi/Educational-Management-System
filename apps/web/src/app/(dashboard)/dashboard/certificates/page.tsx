'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { SearchInput } from '@/components/layout/search-input';
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
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canIssue = can(PERMISSIONS.CERTIFICATES_ISSUE);
  const [issueOpen, setIssueOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { effectiveBranchId } = useEffectiveBranchId(token, user?.branchId);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['certificate-issues', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: IssueRow[] }>(
        `/certificates/issues${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ''}`,
        { token },
      ),
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    const list = data?.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        (row.student?.fullName ?? '').toLowerCase().includes(q) ||
        (row.serialNo ?? '').toLowerCase().includes(q),
    );
  }, [data?.data, search]);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Award}
        title="Certificates"
        description="Issue and print student certificates"
        actions={
          canIssue && effectiveBranchId ? (
            <button type="button" onClick={() => setIssueOpen(true)} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              Issue certificate
            </button>
          ) : undefined
        }
      />

      <ContentPanel
        title={`Issuance history (${filtered.length})`}
        actions={<SearchInput value={search} onChange={handleSearchChange} placeholder="Search by student or title…" className="w-full sm:w-64" />}
      >
        {error ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load certificate history</p>
        ) : (
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
                  <DataTableSkeletonRows columns={6} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}>
                      No certificates issued yet
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
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
                        <Link
                          href={`/print/certificates/${row.id}`}
                          target="_blank"
                          className="text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
                        >
                          Print
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      {canIssue && effectiveBranchId && (
        <IssueCertificateDialog
          open={issueOpen}
          onOpenChange={setIssueOpen}
          branchId={effectiveBranchId}
        />
      )}
    </div>
  );
}
