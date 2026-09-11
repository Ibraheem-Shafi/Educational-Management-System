'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { categoryRowClass } from '@/components/layout/status-badge';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { StudentAssignmentDialog } from './student-assignment-dialog';
import type { StudentTransportAssignment } from './types';
import { formatLabel } from './types';

export function StudentsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<StudentTransportAssignment | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = { search, page, limit };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.transportStudentAssignments(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({ branchId, page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<StudentTransportAssignment>>(
        `/transport/student-assignments?${params.toString()}`,
        { token },
      );
    },
    enabled: !!token && !!branchId,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/transport/student-assignments/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Assignment removed');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transportStudentAssignments(branchId),
      });
    },
    onError: () => toast.error('Unable to remove assignment'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Student assignments (${data?.meta.total ?? rows.length})`}
        actions={
          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              Assign student
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search student name"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load student assignments.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[900px]')}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Route</th>
                    <th className={dataTableThClass}>Stop</th>
                    <th className={dataTableThClass}>Direction</th>
                    <th className={dataTableThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? (
                    <DataTableSkeletonRows columns={5} rows={limit} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                        No student assignments found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className={categoryRowClass(row.direction)}>
                        <td className={dataTableTdClass}>{row.student?.fullName ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.route?.name ?? '—'}</td>
                        <td className={dataTableTdClass}>
                          {row.stop ? `${row.stop.sequence}. ${row.stop.name}` : '—'}
                        </td>
                        <td className={dataTableTdClass}>{formatLabel(row.direction)}</td>
                        <td className={dataTableTdClass}>
                          <PermissionGate permission={PERMISSIONS.TRANSPORT_MANAGE} fallback="—">
                            <RowActionsMenu
                              items={[
                                { label: 'Edit', onClick: () => setEditAssignment(row) },
                                {
                                  label: 'Remove',
                                  onClick: () => {
                                    if (window.confirm('Remove this assignment?')) remove.mutate(row.id);
                                  },
                                },
                              ]}
                            />
                          </PermissionGate>
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
          </>
        )}
      </ContentPanel>

      <StudentAssignmentDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <StudentAssignmentDialog
        open={Boolean(editAssignment)}
        onOpenChange={(open) => {
          if (!open) setEditAssignment(null);
        }}
        branchId={branchId}
        assignment={editAssignment}
      />
    </>
  );
}
