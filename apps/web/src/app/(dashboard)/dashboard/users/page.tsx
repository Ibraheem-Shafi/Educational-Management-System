'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, UserCog, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import type { PaginatedResponse, StaffListRow, UsersStatsResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { UserAvatar } from '@/components/layout/user-avatar';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { ContactIcon } from '@/components/layout/contact-icon';
import { InviteUserDialog } from '@/components/features/users/invite-user-dialog';
import { EditUserDialog } from '@/components/features/users/edit-user-dialog';
import {
  DeactivateUserDialog,
  type DeactivateUserTarget,
} from '@/components/features/users/deactivate-user-dialog';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

interface Role {
  id: string;
  name: string;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function staffStatusLabel(status: StaffListRow['status']): string {
  if (status === 'invited') return 'Invited';
  if (status === 'inactive') return 'Inactive';
  return 'Active';
}

function staffStatusCode(status: StaffListRow['status']): string {
  if (status === 'invited') return 'pending';
  return status;
}

function formatGender(gender: string | null): string {
  if (!gender) return '—';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

export default function UsersPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = can(PERMISSIONS.USERS_MANAGE);

  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateUserTarget | null>(null);

  useEffect(() => {
    if (!canManage) return;
    if (searchParams.get('create') !== '1') return;
    setInviteOpen(true);
    router.replace('/dashboard/users', { scroll: false });
  }, [canManage, router, searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { effectiveScope, scopeKey, appendToSearchParams } = useEffectiveBranchScope();

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  appendToSearchParams(queryParams);
  if (search) queryParams.set('search', search);
  if (roleId) queryParams.set('roleId', roleId);
  if (status) queryParams.set('status', status);

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiClient<{ data: Role[] }>('/users/roles', { token }),
    enabled: !!token,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.usersStats, scopeKey],
    queryFn: () =>
      apiClient<UsersStatsResponse>(withBranchScope('/users/stats', effectiveScope), { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', scopeKey, search, roleId, status, page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<StaffListRow>>(`/users?${queryParams.toString()}`, { token }),
    enabled: !!token,
  });

  const invalidateUserQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.usersStats }),
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
    ]);
  };

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/users/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: false }),
      }),
    onMutate: () => ({ toastId: toast.loading('Deactivating user…') }),
    onSuccess: async (_data, _id, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.success('User deactivated');
      setDeactivateTarget(null);
      await invalidateUserQueries();
    },
    onError: (err: Error, _id, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.error(err.message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/users/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isActive: true }),
      }),
    onMutate: () => ({ toastId: toast.loading('Reactivating user…') }),
    onSuccess: async (_data, _id, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.success('User reactivated');
      await invalidateUserQueries();
    },
    onError: (err: Error, _id, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={UserCog}
        title="Users"
        description="Staff accounts and invitations"
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={pageHeaderActionClassName}
            >
              <UserPlus className="h-4 w-4 shrink-0 text-white" strokeWidth={2} aria-hidden />
              Invite User
            </button>
          ) : undefined
        }
      />

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <EditUserDialog
        userId={editUserId}
        open={editUserId !== null}
        onOpenChange={(open) => {
          if (!open) setEditUserId(null);
        }}
      />

      <DeactivateUserDialog
        user={deactivateTarget}
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        onConfirm={() => {
          if (deactivateTarget) deactivateMutation.mutate(deactivateTarget.id);
        }}
        isPending={deactivateMutation.isPending}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Total Users',
            value: formatCount(stats?.totalUsers.total ?? 0),
            changePercent: stats?.totalUsers.changePercent,
          },
          {
            label: 'Active Users',
            value: formatCount(stats?.activeUsers.total ?? 0),
            changePercent: stats?.activeUsers.changePercent,
          },
          {
            label: 'Inactive Users',
            value: formatCount(stats?.inactiveUsers.total ?? 0),
            changePercent: stats?.inactiveUsers.changePercent,
          },
          {
            label: 'Pending Invitation',
            value: formatCount(stats?.pendingInvitations.total ?? 0),
            changePercent: stats?.pendingInvitations.changePercent,
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        <SelectDropdown
          aria-label="Filter by role"
          placeholder="All Role"
          value={roleId}
          onValueChange={(next) => {
            setRoleId(next);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Role' },
            ...(roles?.data.map((role) => ({ value: role.id, label: role.name })) ?? []),
          ]}
        />
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
            { value: 'invited', label: 'Invited' },
          ]}
        />
        <PageBranchScopeControl />
        {(search || roleId || status) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setRoleId('');
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
          <table className="w-full min-w-[1180px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Staff ID</th>
                <th className={thClass}>Staff Name</th>
                <th className={thClass}>Email / Phone</th>
                <th className={thClass}>CNIC</th>
                <th className={thClass}>Gender</th>
                <th className={thClass}>Branch</th>
                <th className={thClass}>Role</th>
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
                    Failed to load users
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No users found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                data?.data.map((staff) => (
                  <tr key={staff.id} className="transition-colors hover:bg-[var(--neutral-50)]/50">
                    <td className={cn(tdClass, 'whitespace-nowrap')}>{staff.staffCode}</td>
                    <td className={tdClass}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          name={staff.fullName}
                          gender={staff.gender}
                          seed={staff.id}
                          size="sm"
                        />
                        {staff.isInvitation ? (
                          <span className="truncate font-normal text-[var(--text-main-900,#0A0D14)]">
                            {staff.fullName}
                          </span>
                        ) : (
                          <Link
                            href={`/dashboard/users/${staff.id}`}
                            className="truncate font-normal text-[var(--text-main-900,#0A0D14)] hover:underline"
                          >
                            {staff.fullName}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <ContactIcon kind="email" value={staff.email}>
                          <Mail className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                        <ContactIcon kind="phone" value={staff.phone}>
                          <Phone className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                      </div>
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap')}>{staff.cnic ?? '—'}</td>
                    <td className={tdClass}>{formatGender(staff.gender)}</td>
                    <td className={tdClass}>{staff.branchName ?? '—'}</td>
                    <td className={tdClass}>{staff.roleName}</td>
                    <td className={tdClass}>
                      <StatusBadge
                        label={staffStatusLabel(staff.status)}
                        code={staffStatusCode(staff.status)}
                      />
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      {!staff.isInvitation ? (
                        <RowActionsMenu
                          items={[
                            {
                              label: 'View details',
                              href: `/dashboard/users/${staff.id}`,
                            },
                            ...(canManage
                              ? [
                                  {
                                    label: 'Edit',
                                    onClick: () => setEditUserId(staff.id),
                                  },
                                ]
                              : []),
                            ...(canManage &&
                            staff.status === 'active' &&
                            staff.roleCode !== 'super_admin'
                              ? [
                                  {
                                    label: 'Deactivate',
                                    onClick: () => {
                                      setDeactivateTarget({
                                        id: staff.id,
                                        fullName: staff.fullName,
                                        staffCode: staff.staffCode,
                                      });
                                    },
                                  },
                                ]
                              : []),
                            ...(canManage && staff.status === 'inactive'
                              ? [
                                  {
                                    label: 'Reactivate',
                                    onClick: () => reactivateMutation.mutate(staff.id),
                                  },
                                ]
                              : []),
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
