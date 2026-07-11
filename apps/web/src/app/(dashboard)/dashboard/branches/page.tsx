'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { BranchListRow, BranchesStatsResponse, PaginatedResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { AddBranchDialog } from '@/components/features/branches/add-branch-dialog';
import { EditBranchDialog } from '@/components/features/branches/edit-branch-dialog';
import {
  DeactivateBranchDialog,
  type DeactivateBranchTarget,
} from '@/components/features/branches/deactivate-branch-dialog';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

function formatBranchId(code: string): string {
  return `BR-${code.toUpperCase()}`;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
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

export default function BranchesPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.BRANCHES_MANAGE);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [editBranchId, setEditBranchId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateBranchTarget | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) queryParams.set('search', search);
  if (status) queryParams.set('status', status);

  const { data, isLoading, error } = useQuery({
    queryKey: ['branches', search, status, page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<BranchListRow>>(`/branches?${queryParams.toString()}`, {
        token,
      }),
    enabled: !!token,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.branchesStats,
    queryFn: () => apiClient<BranchesStatsResponse>('/branches/stats', { token }),
    enabled: !!token,
  });

  const invalidateBranchQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['branches'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.branches });
    queryClient.invalidateQueries({ queryKey: queryKeys.branchesStats });
  };

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/branches/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Branch deactivated');
      setDeactivateTarget(null);
      invalidateBranchQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Building2}
        title="Branches"
        description="Manage institution branches"
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setAddBranchOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              Add branch
            </button>
          ) : undefined
        }
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Total Branches',
            value: formatCount(stats?.totalBranches.total ?? 0),
            changePercent: stats?.totalBranches.changePercent,
          },
          {
            label: 'Active Branches',
            value: formatCount(stats?.activeBranches.total ?? 0),
            changePercent: stats?.activeBranches.changePercent,
          },
          {
            label: 'Inactive Branches',
            value: formatCount(stats?.inactiveBranches.total ?? 0),
            changePercent: stats?.inactiveBranches.changePercent,
          },
          {
            label: 'Total Students',
            value: formatCount(stats?.totalStudents.total ?? 0),
            changePercent: stats?.totalStudents.changePercent,
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        <SelectDropdown
          aria-label="Filter by status"
          placeholder="All Status"
          value={status}
          onValueChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        {(search || status) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setStatus('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Branch ID</th>
                <th className={thClass}>Branch Name</th>
                <th className={thClass}>Address</th>
                <th className={thClass}>Email / Phone</th>
                <th className={thClass}>Principal</th>
                <th className={thClass}>Students</th>
                <th className={thClass}>Staff</th>
                <th className={thClass}>Status</th>
                <th className={cn(thClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading &&
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className={tdClass}>
                        <div className="h-4 w-16 animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    ))}
                  </tr>
                ))}

              {error && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load branches
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No branches found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                data?.data.map((branch) => (
                  <tr key={branch.id} className="transition-colors hover:bg-[var(--neutral-50)]/50">
                    <td className={cn(tdClass, 'whitespace-nowrap')}>{formatBranchId(branch.code)}</td>
                    <td className={cn(tdClass, 'font-medium')}>{branch.name}</td>
                    <td className={tdClass}>{branch.addressLabel}</td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <ContactIcon
                          href={branch.email ? `mailto:${branch.email}` : undefined}
                          label={branch.email ?? 'No email'}
                          disabled={!branch.email}
                        >
                          <Mail className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                        <ContactIcon
                          href={branch.phone ? `tel:${branch.phone}` : undefined}
                          label={branch.phone ?? 'No phone'}
                          disabled={!branch.phone}
                        >
                          <Phone className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                      </div>
                    </td>
                    <td className={tdClass}>{branch.principalName ?? '—'}</td>
                    <td className={tdClass}>{formatCount(branch.studentCount)}</td>
                    <td className={tdClass}>{formatCount(branch.staffCount)}</td>
                    <td className={tdClass}>
                      <StatusBadge
                        label={branch.isActive ? 'Active' : 'Inactive'}
                        code={branch.isActive ? 'active' : 'inactive'}
                      />
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <RowActionsMenu
                        items={[
                          {
                            label: 'View branch',
                            href: `/dashboard/branches/${branch.id}`,
                          },
                          ...(canManage && branch.isActive
                            ? [
                                {
                                  label: 'Edit branch',
                                  onClick: () => setEditBranchId(branch.id),
                                },
                                {
                                  label: 'Deactivate',
                                  onClick: () =>
                                    setDeactivateTarget({
                                      id: branch.id,
                                      name: branch.name,
                                      code: branch.code,
                                    }),
                                },
                              ]
                            : []),
                        ]}
                      />
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

      <AddBranchDialog open={addBranchOpen} onOpenChange={setAddBranchOpen} />

      <EditBranchDialog
        branchId={editBranchId}
        open={editBranchId !== null}
        onOpenChange={(open) => {
          if (!open) setEditBranchId(null);
        }}
      />

      <DeactivateBranchDialog
        branch={deactivateTarget}
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        onConfirm={() => {
          if (deactivateTarget) deactivateMutation.mutate(deactivateTarget.id);
        }}
        isPending={deactivateMutation.isPending}
      />
    </div>
  );
}
