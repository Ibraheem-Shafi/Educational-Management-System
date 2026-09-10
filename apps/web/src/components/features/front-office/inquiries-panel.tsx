'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { inquiryStatuses, PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { FrontOfficeDetailDialog } from './front-office-detail-dialog';
import { InquiryDialog } from './inquiry-dialog';
import type { AdmissionInquiry } from './types';
import { formatDateTime, formatLabel, statusBadgeCode } from './types';

export function InquiriesPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.FRONT_OFFICE_MANAGE);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editInquiry, setEditInquiry] = useState<AdmissionInquiry | null>(null);
  const [viewInquiry, setViewInquiry] = useState<AdmissionInquiry | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.frontOfficeInquiries(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<AdmissionInquiry>>(`/inquiries?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/inquiries/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Inquiry deleted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeInquiries(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
    },
    onError: () => toast.error('Unable to delete inquiry'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Inquiries (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New inquiry
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search by name, phone, email"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Status filter"
              placeholder="All statuses"
              value={statusFilter}
              onValueChange={(next) => {
                setStatusFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All statuses' },
                ...inquiryStatuses.map((s) => ({ value: s, label: formatLabel(s) })),
              ]}
              className="w-full sm:w-[180px]"
            />
            {(search || statusFilter) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load inquiries.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[960px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Name</th>
                    <th className={dataTableThClass}>Phone</th>
                    <th className={dataTableThClass}>Email</th>
                    <th className={dataTableThClass}>Program</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={dataTableThClass}>Follow-up</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={7} rows={limit} />
                  ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No inquiries found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={statusRowClass(statusBadgeCode(row.status), formatLabel(row.status))}
                    >
                      <td className={dataTableTdClass}>{row.fullName}</td>
                      <td className={dataTableTdClass}>{row.phone ?? '—'}</td>
                      <td className={dataTableTdClass}>{row.email ?? '—'}</td>
                      <td className={dataTableTdClass}>{row.programInterest ?? '—'}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge
                          label={formatLabel(row.status)}
                          code={statusBadgeCode(row.status)}
                        />
                      </td>
                      <td className={dataTableTdClass}>{formatDateTime(row.followUpAt)}</td>
                      <td className={dataTableTdClass}>
                        <RowActionsMenu
                          items={[
                            { label: 'View', onClick: () => setViewInquiry(row) },
                            ...(canManage && !row.convertedStudentId && row.status !== 'enrolled'
                              ? [
                                  {
                                    label: 'Convert',
                                    href: `/dashboard/students/new?inquiryId=${row.id}`,
                                  },
                                ]
                              : []),
                            ...(canManage
                              ? [
                                  { label: 'Edit', onClick: () => setEditInquiry(row) },
                                  {
                                    label: 'Delete',
                                    onClick: () => {
                                      if (window.confirm('Delete this inquiry?')) {
                                        remove.mutate(row.id);
                                      }
                                    },
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
            {data && (
              <PaginationBar
                page={page}
                totalPages={data.meta.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
              />
            )}
          </>
        )}
      </ContentPanel>

      <InquiryDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <InquiryDialog
        open={Boolean(editInquiry)}
        onOpenChange={(open) => {
          if (!open) setEditInquiry(null);
        }}
        branchId={branchId}
        inquiry={editInquiry}
      />
      <FrontOfficeDetailDialog
        open={Boolean(viewInquiry)}
        onOpenChange={(open) => {
          if (!open) setViewInquiry(null);
        }}
        title="Inquiry details"
        description="Admission inquiry record"
        icon={UserPlus}
        fields={
          viewInquiry
            ? [
                { label: 'Full name', value: viewInquiry.fullName },
                {
                  label: 'Status',
                  value: (
                    <StatusBadge
                      label={formatLabel(viewInquiry.status)}
                      code={statusBadgeCode(viewInquiry.status)}
                    />
                  ),
                },
                { label: 'Phone', value: viewInquiry.phone ?? '—' },
                { label: 'Email', value: viewInquiry.email ?? '—' },
                { label: 'Program interest', value: viewInquiry.programInterest ?? '—' },
                { label: 'Follow-up', value: formatDateTime(viewInquiry.followUpAt) },
                {
                  label: 'Converted student',
                  value: viewInquiry.convertedStudentId ? (
                    <Link
                      href={`/dashboard/students/${viewInquiry.convertedStudentId}`}
                      className="text-[var(--midnight-blue-950)] underline-offset-2 hover:underline"
                    >
                      View student
                    </Link>
                  ) : (
                    'Not converted'
                  ),
                },
                { label: 'Created', value: formatDateTime(viewInquiry.createdAt) },
                { label: 'Updated', value: formatDateTime(viewInquiry.updatedAt) },
                { label: 'Notes', value: viewInquiry.notes ?? '—', fullWidth: true },
              ]
            : []
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setViewInquiry(null)}>
              Close
            </Button>
            {canManage && viewInquiry ? (
              <Button
                type="button"
                onClick={() => {
                  setEditInquiry(viewInquiry);
                  setViewInquiry(null);
                }}
              >
                Edit
              </Button>
            ) : null}
          </div>
        }
      />
    </>
  );
}
