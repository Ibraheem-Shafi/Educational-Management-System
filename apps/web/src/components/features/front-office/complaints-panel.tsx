'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { complaintStatuses, complaintTypes, PERMISSIONS, priorities } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
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
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import { ComplaintDialog } from './complaint-dialog';
import type { ComplaintRequest } from './types';
import { formatDateTime, formatLabel, statusBadgeCode } from './types';

export function ComplaintsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editComplaint, setEditComplaint] = useState<ComplaintRequest | null>(null);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const queryParams = {
    branchId,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.frontOfficeComplaints(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search) params.set('search', search);
      return apiClient<{ data: ComplaintRequest[] }>(`/complaints?${params.toString()}`, { token });
    },
    enabled: !!token && !!branchId,
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
        title={`Complaints & requests (${rows.length})`}
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
              onValueChange={setTypeFilter}
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
              onValueChange={setStatusFilter}
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
              onValueChange={setPriorityFilter}
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
                  <DataTableSkeletonRows columns={7} rows={5} />
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
                        <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE} fallback="—">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setEditComplaint(row)}
                              aria-label="Edit record"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (window.confirm('Delete this record?')) remove.mutate(row.id);
                              }}
                              aria-label="Delete record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
    </>
  );
}
