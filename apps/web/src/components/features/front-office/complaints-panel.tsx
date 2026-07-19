'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { complaintStatuses, complaintTypes, PERMISSIONS, priorities } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { ComplaintDialog } from './complaint-dialog';
import { FrontOfficeDetailDialog } from './front-office-detail-dialog';
import type { ComplaintRequest } from './types';
import { formatDateTime, formatLabel, statusBadgeCode } from './types';

export function ComplaintsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.FRONT_OFFICE_MANAGE);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editComplaint, setEditComplaint] = useState<ComplaintRequest | null>(null);
  const [viewComplaint, setViewComplaint] = useState<ComplaintRequest | null>(null);

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
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.frontOfficeComplaints(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<ComplaintRequest>>(
        `/complaints?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/complaints/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Record deleted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeComplaints(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
    },
    onError: () => toast.error('Unable to delete record'),
  });

  const rows = data?.data ?? [];
  const hasFilters = search || typeFilter || statusFilter || priorityFilter;

  return (
    <>
      <ContentPanel
        title={`Complaints & requests (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              New record
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search subject or requester"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Type filter"
              placeholder="All types"
              value={typeFilter}
              onValueChange={(next) => {
                setTypeFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                ...complaintTypes.map((t) => ({ value: t, label: formatLabel(t) })),
              ]}
              className="w-full sm:w-[150px]"
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
                ...complaintStatuses.map((s) => ({ value: s, label: formatLabel(s) })),
              ]}
              className="w-full sm:w-[150px]"
            />
            <SelectDropdown
              aria-label="Priority filter"
              placeholder="All priorities"
              value={priorityFilter}
              onValueChange={(next) => {
                setPriorityFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All priorities' },
                ...priorities.map((p) => ({ value: p, label: formatLabel(p) })),
              ]}
              className="w-full sm:w-[150px]"
            />
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('');
                  setStatusFilter('');
                  setPriorityFilter('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load complaints.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[960px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Type</th>
                    <th className={dataTableThClass}>Subject</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={dataTableThClass}>Priority</th>
                    <th className={dataTableThClass}>Requester</th>
                    <th className={dataTableThClass}>Created</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={7} rows={limit} />
                  ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No records found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={dataTableRowHoverClass}>
                      <td className={dataTableTdClass}>{formatLabel(row.type)}</td>
                      <td className={dataTableTdClass}>{row.subject}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge
                          label={formatLabel(row.status)}
                          code={statusBadgeCode(row.status)}
                        />
                      </td>
                      <td className={dataTableTdClass}>{formatLabel(row.priority)}</td>
                      <td className={dataTableTdClass}>{row.requesterName ?? '—'}</td>
                      <td className={dataTableTdClass}>{formatDateTime(row.createdAt)}</td>
                      <td className={dataTableTdClass}>
                        <RowActionsMenu
                          items={[
                            { label: 'View', onClick: () => setViewComplaint(row) },
                            ...(canManage
                              ? [
                                  { label: 'Edit', onClick: () => setEditComplaint(row) },
                                  {
                                    label: 'Delete',
                                    onClick: () => {
                                      if (window.confirm('Delete this record?')) {
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

      <ComplaintDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <ComplaintDialog
        open={Boolean(editComplaint)}
        onOpenChange={(open) => {
          if (!open) setEditComplaint(null);
        }}
        branchId={branchId}
        complaint={editComplaint}
      />
      <FrontOfficeDetailDialog
        open={Boolean(viewComplaint)}
        onOpenChange={(open) => {
          if (!open) setViewComplaint(null);
        }}
        title="Complaint details"
        description="Complaint or request record"
        icon={MessageSquareWarning}
        fields={
          viewComplaint
            ? [
                { label: 'Type', value: formatLabel(viewComplaint.type) },
                { label: 'Priority', value: formatLabel(viewComplaint.priority) },
                {
                  label: 'Status',
                  value: (
                    <StatusBadge
                      label={formatLabel(viewComplaint.status)}
                      code={statusBadgeCode(viewComplaint.status)}
                    />
                  ),
                },
                { label: 'Subject', value: viewComplaint.subject, fullWidth: true },
                { label: 'Requester', value: viewComplaint.requesterName ?? '—' },
                { label: 'Requester phone', value: viewComplaint.requesterPhone ?? '—' },
                { label: 'Created', value: formatDateTime(viewComplaint.createdAt) },
                { label: 'Resolved', value: formatDateTime(viewComplaint.resolvedAt) },
                { label: 'Details', value: viewComplaint.body || '—', fullWidth: true },
              ]
            : []
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setViewComplaint(null)}>
              Close
            </Button>
            {canManage && viewComplaint ? (
              <Button
                type="button"
                onClick={() => {
                  setEditComplaint(viewComplaint);
                  setViewComplaint(null);
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
