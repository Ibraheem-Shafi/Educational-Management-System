'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Mail, Phone } from 'lucide-react';
import type { DashboardBranchPerformanceResponse } from '@eims/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge } from '@/components/layout/status-badge';
import { cn } from '@/lib/utils';

function formatStudentCount(value: number): string {
  return value.toLocaleString('en-US');
}

function ContactIconButton({
  href,
  label,
  children,
}: {
  href?: string | null;
  label: string;
  children: ReactNode;
}) {
  const className = cn(
    'flex h-8 w-8 items-center justify-center rounded-full border border-stroke-soft-200 bg-white',
    'text-text-sub-500 transition-colors',
    href ? 'hover:bg-neutral-50 hover:text-text-main-900' : 'cursor-default opacity-40',
  );

  if (!href) {
    return (
      <span className={className} aria-hidden>
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  );
}

function AttendanceCell({ rate }: { rate: number }) {
  const clamped = Math.max(0, Math.min(rate, 100));

  return (
    <div className="flex min-w-[112px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E2E4E9]">
        <div
          className="h-full rounded-full bg-[#003E73]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-sm font-medium text-text-main-900">
        {clamped}%
      </span>
    </div>
  );
}

export function BranchPerformanceCard({
  data,
  isLoading,
  showViewAll = false,
}: {
  data?: DashboardBranchPerformanceResponse;
  isLoading?: boolean;
  /** Requires `branches.manage`. */
  showViewAll?: boolean;
}) {
  if (isLoading || !data) {
    return (
      <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
        <div className="flex flex-col gap-3 border-b border-stroke-soft-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          {showViewAll && <Skeleton className="h-9 w-36 rounded-[10px]" />}
        </div>
        <div className="space-y-3 px-5 py-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
      <div className="flex flex-col gap-3 border-b border-stroke-soft-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-medium leading-6 text-text-main-900">Branch Performance</h3>
          <p className="text-sm font-normal leading-5 text-text-sub-500">
            Real-time metrics across all campuses
          </p>
        </div>
        {showViewAll && (
          <Link
            href="/dashboard/branches"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-stroke-soft-200 bg-white px-3 text-sm font-medium text-text-main-900 transition-colors hover:bg-neutral-50"
          >
            View All Branches
            <ArrowUpRight className="h-4 w-4 text-text-sub-500" strokeWidth={1.75} />
          </Link>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full border-collapse">
          <thead>
            <tr className="bg-[#F8F8F8]">
              {[
                'Branch Name',
                'Address',
                'Email / Phone',
                'Principal',
                'Students',
                'Attendance',
                'Status',
                '',
              ].map((label) => (
                <th
                  key={label || 'actions'}
                  scope="col"
                  className={cn(
                    'px-5 py-2.5 text-left text-sm font-normal leading-5 text-text-sub-500',
                    label === '' && 'w-12',
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.branches.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-sm text-text-sub-500">
                  No branches found.
                </td>
              </tr>
            ) : (
              data.branches.map((branch, index) => (
                <tr
                  key={branch.id}
                  className={cn(index < data.branches.length - 1 && 'border-b border-stroke-soft-200')}
                >
                  <td className="px-5 py-4 text-sm font-medium text-text-main-900">{branch.name}</td>
                  <td className="px-5 py-4 text-sm text-text-sub-500">{branch.addressLabel}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <ContactIconButton
                        href={branch.email ? `mailto:${branch.email}` : null}
                        label={`Email ${branch.name}`}
                      >
                        <Mail className="h-4 w-4" strokeWidth={1.75} />
                      </ContactIconButton>
                      <ContactIconButton
                        href={branch.phone ? `tel:${branch.phone}` : null}
                        label={`Call ${branch.name}`}
                      >
                        <Phone className="h-4 w-4" strokeWidth={1.75} />
                      </ContactIconButton>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-main-900">
                    {branch.principalName ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-text-main-900">
                    {formatStudentCount(branch.studentCount)}
                  </td>
                  <td className="px-5 py-4">
                    <AttendanceCell rate={branch.attendanceRate} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge
                      label={branch.isActive ? 'Active' : 'Inactive'}
                      code={branch.isActive ? 'active' : 'inactive'}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <RowActionsMenu
                      items={[
                        {
                          label: 'View branch',
                          href: `/dashboard/branches/${branch.id}`,
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
    </div>
  );
}
