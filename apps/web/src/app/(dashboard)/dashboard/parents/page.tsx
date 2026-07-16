'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse, ParentsStatsResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { FilterBar } from '@/components/layout/filter-bar';
import { UserAvatar } from '@/components/layout/user-avatar';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { AddParentDialog } from '@/components/features/parents/add-parent-dialog';
import { LinkStudentDialog } from '@/components/features/parents/link-student-dialog';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface ParentRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  students: Array<{ relationshipCode: string; student: { id: string; fullName: string } }>;
}

function ContactIcon({
  href,
  label,
  children,
  disabled,
}: {
  href?: string;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const className = cn(
    'flex h-8 w-8 items-center justify-center rounded-full border-[0.8px] border-[var(--stroke-soft-200,#E2E4E9)] p-2',
    'text-[var(--text-sub-500,#525866)] transition-colors',
    disabled
      ? 'cursor-not-allowed opacity-40'
      : 'hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]',
  );

  if (disabled || !href) {
    return (
      <span className={className} aria-label={label} title={label}>
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} aria-label={label} title={label} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export default function ParentsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canUpdate = can(PERMISSIONS.STUDENTS_UPDATE);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [addOpen, setAddOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string } | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) queryParams.set('search', search);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.parentsStats,
    queryFn: () => apiClient<ParentsStatsResponse>('/parents/stats', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['parents', search, page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<ParentRow>>(`/parents?${queryParams.toString()}`, { token }),
    enabled: !!token,
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ parentId, studentId }: { parentId: string; studentId: string }) =>
      apiClient(`/parents/${parentId}/students/${studentId}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Student unlinked');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.parentsStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Users}
        title="Parents"
        description="Guardians linked to students"
        actions={
          canUpdate ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              Add parent
            </button>
          ) : undefined
        }
      />

      <AddParentDialog open={addOpen} onOpenChange={setAddOpen} />

      <LinkStudentDialog
        open={linkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLinkTarget(null);
        }}
        parentId={linkTarget?.id ?? ''}
        parentName={linkTarget?.name ?? ''}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Total parents',
            value: formatCount(stats?.totalParents.total ?? 0),
            changePercent: stats?.totalParents.changePercent,
          },
          {
            label: 'Linked students',
            value: formatCount(stats?.linkedStudents.total ?? 0),
            changePercent: stats?.linkedStudents.changePercent,
          },
          {
            label: 'Unlinked parents',
            value: formatCount(stats?.unlinkedParents.total ?? 0),
            changePercent: stats?.unlinkedParents.changePercent,
          },
          {
            label: 'New (30d)',
            value: formatCount(stats?.newLast30Days.total ?? 0),
            changePercent: stats?.newLast30Days.changePercent,
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        {search && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Parent</th>
                <th className={dataTableThClass}>Email / Phone</th>
                <th className={dataTableThClass}>Linked students</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={4} rows={limit} />}

              {error && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load parents
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No parents found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                data?.data.map((parent) => (
                  <tr key={parent.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                    <td className={dataTableTdClass}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar name={parent.fullName} seed={parent.id} size="sm" />
                        <span className="truncate font-normal text-[var(--text-main-900,#0A0D14)]">
                          {parent.fullName}
                        </span>
                      </div>
                    </td>
                    <td className={dataTableTdClass}>
                      <div className="flex items-center gap-2">
                        <ContactIcon
                          href={parent.email ? `mailto:${parent.email}` : undefined}
                          label={parent.email ?? 'No email'}
                          disabled={!parent.email}
                        >
                          <Mail className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                        <ContactIcon
                          href={parent.phone ? `tel:${parent.phone}` : undefined}
                          label={parent.phone ?? 'No phone'}
                          disabled={!parent.phone}
                        >
                          <Phone className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                      </div>
                    </td>
                    <td className={dataTableTdClass}>
                      {parent.students.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {parent.students.map((s) => (
                            <span key={s.student.id} className="text-sm">
                              {s.student.fullName}{' '}
                              <span className="text-[var(--text-sub-500,#525866)]">
                                ({s.relationshipCode})
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      {canUpdate ? (
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Link student',
                              onClick: () =>
                                setLinkTarget({ id: parent.id, name: parent.fullName }),
                            },
                            ...parent.students.map((s) => ({
                              label: `Unlink ${s.student.fullName}`,
                              onClick: () =>
                                unlinkMutation.mutate({
                                  parentId: parent.id,
                                  studentId: s.student.id,
                                }),
                            })),
                          ]}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data && (
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
    </div>
  );
}
