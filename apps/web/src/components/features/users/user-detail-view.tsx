'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Mail,
  Phone,
  ScrollText,
  Shield,
  SquarePen,
  Star,
  UserCog,
} from 'lucide-react';
import type { UserDetailResponse, UserPermissionDetail } from '@eims/types';
import { StatusBadge } from '@/components/layout/status-badge';
import { UserAvatar } from '@/components/layout/user-avatar';
import { pageHeaderActionClassName } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';
import { UserContractsSection } from '@/components/features/users/user-contracts-section';
import { UserReviewsSection } from '@/components/features/users/user-reviews-section';
import { UserFilesSection } from '@/components/features/users/user-files-section';
import { UserAccessPanel } from '@/components/features/users/user-access-panel';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS, isSuperAdmin } from '@eims/shared';

function formatGender(gender: string | null): string {
  if (!gender) return '—';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatModuleLabel(module: string): string {
  return module
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function groupPermissions(permissions: UserPermissionDetail[]) {
  const groups = new Map<string, UserPermissionDetail[]>();
  for (const permission of permissions) {
    const list = groups.get(permission.module) ?? [];
    list.push(permission);
    groups.set(permission.module, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function DetailCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Icon className="h-4 w-4 text-[var(--text-sub-500,#525866)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-medium leading-6 tracking-[-0.011em] text-[var(--text-main-900)]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
        {value || '—'}
      </p>
    </div>
  );
}

export function UserDetailSkeleton() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <div className="h-8 w-48 animate-pulse rounded bg-[var(--neutral-50)]" />
      <div className="h-40 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
      <div className="h-48 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
      <div className="h-64 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
    </div>
  );
}

export function UserDetailView({
  user,
  onEdit,
  onReactivate,
  reactivatePending,
}: {
  user: UserDetailResponse;
  onEdit?: () => void;
  onReactivate?: () => void;
  reactivatePending?: boolean;
}) {
  const permissionGroups = useMemo(
    () => groupPermissions(user.permissions ?? []),
    [user.permissions],
  );
  const { can, user: actor } = usePermissions();
  const canViewHr = can(PERMISSIONS.HR_READ);
  const canViewPayroll = can(PERMISSIONS.PAYROLL_READ);
  const canViewDocs = can(PERMISSIONS.DOCUMENTS_READ);
  const canEditAccess = isSuperAdmin(actor?.roles ?? []);

  const primaryRole = user.roles[0] ?? null;
  const permissionCount = user.permissions?.length ?? 0;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--text-sub-500)]">
        <Link href="/dashboard/users" className="hover:text-[var(--text-main-900)]">
          Users
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-[var(--text-main-900)]">{user.fullName}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <UserAvatar name={user.fullName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-main-900)]">
                {user.fullName}
              </h1>
              <StatusBadge
                label={user.isActive ? 'Active' : 'Inactive'}
                code={user.isActive ? 'active' : 'inactive'}
              />
            </div>
            <p className="mt-1 text-sm text-[var(--text-sub-500)]">
              {user.staffCode}
              {primaryRole ? ` · ${primaryRole.name}` : ''}
              {user.branch ? ` · ${user.branch.name}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <a
                href={`mailto:${user.email}`}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--text-sub-500)] hover:text-[var(--text-main-900)]"
              >
                <Mail className="h-4 w-4" strokeWidth={1.5} />
                {user.email}
              </a>
              {user.phone && (
                <a
                  href={`tel:${user.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--text-sub-500)] hover:text-[var(--text-main-900)]"
                >
                  <Phone className="h-4 w-4" strokeWidth={1.5} />
                  {user.phone}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onEdit && (
            <button type="button" onClick={onEdit} className={pageHeaderActionClassName}>
              <SquarePen className="h-4 w-4 shrink-0 text-white" strokeWidth={2} aria-hidden />
              Edit user
            </button>
          )}
          {onReactivate && !user.isActive && (
            <button
              type="button"
              onClick={onReactivate}
              disabled={reactivatePending}
              className={cn(
                pageHeaderActionClassName,
                'inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {reactivatePending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" aria-hidden />
              ) : null}
              {reactivatePending ? 'Reactivating…' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      <DetailCard title="Profile" icon={Info}>
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Full name" value={user.fullName} />
          <InfoField label="Staff code" value={user.staffCode} />
          <InfoField label="Email" value={user.email} />
          <InfoField label="Phone" value={user.phone ?? '—'} />
          <InfoField label="Gender" value={formatGender(user.gender)} />
          <InfoField label="CNIC" value={user.cnic ?? '—'} />
          <InfoField label="Branch" value={user.branch?.name ?? 'All branches'} />
          <InfoField label="Department" value={user.department ?? '—'} />
          <InfoField label="Designation" value={user.designation ?? '—'} />
          <InfoField label="Last login" value={formatDateTime(user.lastLoginAt)} />
          <InfoField label="Joined" value={formatDateTime(user.createdAt)} />
        </div>
      </DetailCard>

      {canViewHr && (
        <>
          <DetailCard title="Contracts" icon={ScrollText}>
            <div className="px-5 py-5">
              <UserContractsSection userId={user.id} branchId={user.branchId} />
            </div>
          </DetailCard>
          <DetailCard title="Performance reviews" icon={Star}>
            <div className="px-5 py-5">
              <UserReviewsSection userId={user.id} branchId={user.branchId} />
            </div>
          </DetailCard>
        </>
      )}

      {canViewPayroll && (
        <DetailCard title="Payroll" icon={ScrollText}>
          <div className="px-5 py-5">
            <p className="text-sm text-[var(--text-sub-500)]">
              View and manage salary structures for this staff member.
            </p>
            <Link
              href={`/dashboard/payroll?userId=${user.id}`}
              className="mt-3 inline-flex text-sm font-medium text-[var(--midnight-blue-950,#01366C)] hover:underline"
            >
              Open payroll structures
            </Link>
          </div>
        </DetailCard>
      )}

      {canViewDocs && (
        <DetailCard title="Files" icon={FileText}>
          <div className="px-5 py-5">
            <UserFilesSection userId={user.id} branchId={user.branchId} />
          </div>
        </DetailCard>
      )}

      <DetailCard title={`Roles & permissions (${permissionCount})`} icon={Shield}>
        <div className="space-y-6 px-5 py-5">
          {canEditAccess ? (
            <UserAccessPanel userId={user.id} />
          ) : (
            <>
          <div>
            <h3 className="mb-3 text-sm font-medium tracking-[-0.006em] text-[var(--text-main-900)]">
              Roles
            </h3>
            {user.roles.length === 0 ? (
              <p className="text-sm text-[var(--text-sub-500)]">No roles assigned</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {user.roles.map((role) => (
                  <div
                    key={role.id}
                    className="min-w-[200px] flex-1 rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-[var(--text-sub-500)]" strokeWidth={1.5} />
                      <p className="text-sm font-medium text-[var(--text-main-900)]">{role.name}</p>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[var(--text-sub-500)]">{role.code}</p>
                    {role.description && (
                      <p className="mt-2 text-sm text-[var(--text-sub-500)]">{role.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium tracking-[-0.006em] text-[var(--text-main-900)]">
              Permissions
            </h3>
            {permissionGroups.length === 0 ? (
              <p className="text-sm text-[var(--text-sub-500)]">No permissions assigned</p>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)]">
                <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-0">
                  <colgroup>
                    <col className="w-[42%]" />
                    <col className="w-[58%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[var(--palette-teal-soft)]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
                        Permission
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissionGroups.map(([module, permissions]) => (
                      <PermissionModuleRows
                        key={module}
                        module={module}
                        permissions={permissions}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </DetailCard>
    </div>
  );
}

function PermissionModuleRows({
  module,
  permissions,
}: {
  module: string;
  permissions: UserPermissionDetail[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={2}
          className="border-t border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--neutral-50,#FAFAFA)] px-4 py-2 text-sm font-medium text-[var(--text-main-900)]"
        >
          {formatModuleLabel(module)}
        </td>
      </tr>
      {permissions.map((permission) => (
        <tr key={permission.code}>
          <td className="border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2.5 font-mono text-sm text-[var(--text-main-900)]">
            {permission.code}
          </td>
          <td className="border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-2.5 text-sm text-[var(--text-sub-500)]">
            {permission.name}
          </td>
        </tr>
      ))}
    </>
  );
}
