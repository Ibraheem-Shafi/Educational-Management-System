'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  Building2,
  FileBarChart,
  GraduationCap,
  Megaphone,
  Wallet,
} from 'lucide-react';
import { PERMISSIONS } from '@eims/shared';
import { usePermissions } from '@/hooks/use-permissions';
import type { Permission } from '@/lib/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const QUICK_ACTIONS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}> = [
  {
    label: 'Add Branch',
    href: '/dashboard/branches?create=1',
    icon: Building2,
    permission: PERMISSIONS.BRANCHES_MANAGE,
  },
  {
    label: 'Add Student',
    href: '/dashboard/students/new',
    icon: GraduationCap,
    permission: PERMISSIONS.STUDENTS_CREATE,
  },
  {
    label: 'Add Teacher',
    href: '/dashboard/users?create=1',
    icon: BookOpen,
    permission: PERMISSIONS.USERS_MANAGE,
  },
  {
    label: 'Create Notice',
    href: '/dashboard/notices?create=1',
    icon: Megaphone,
    permission: PERMISSIONS.STUDENTS_UPDATE,
  },
  {
    label: 'Collect Fee',
    href: '/dashboard/fees',
    icon: Wallet,
    permission: PERMISSIONS.FEES_COLLECT,
  },
  {
    label: 'Generate Report',
    href: '/dashboard/reports',
    icon: FileBarChart,
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    label: 'View Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    permission: PERMISSIONS.ANALYTICS_READ,
  },
];

export function QuickActionsCard({ isLoading }: { isLoading?: boolean }) {
  const { can } = usePermissions();
  const actions = QUICK_ACTIONS.filter((action) => can(action.permission));

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-44" />
        </div>
        <div className="grid grid-cols-2 gap-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[88px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
      <div className="border-b border-stroke-soft-200 px-5 py-4">
        <h3 className="text-base font-medium leading-6 text-text-main-900">Quick Actions</h3>
        <p className="text-sm font-normal leading-5 text-text-sub-500">
          Shortcuts to common tasks
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5">
        {actions.length === 0 ? (
          <p className="col-span-2 py-6 text-center text-sm text-text-sub-500">
            No quick actions available
          </p>
        ) : (
          actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-xl border border-stroke-soft-200',
                  'bg-white px-3 py-4 text-center transition-colors hover:bg-neutral-50',
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF]">
                  <Icon className="h-5 w-5 text-[#2563EB]" strokeWidth={1.75} />
                </span>
                <span className="text-sm font-medium leading-5 text-text-main-900">
                  {action.label}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
