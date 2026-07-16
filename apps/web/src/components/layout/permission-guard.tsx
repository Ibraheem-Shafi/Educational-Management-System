'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { getRequiredPermissionForPath, hasPermission } from '@/lib/permissions';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

export function PermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <PageContentSkeleton />;
  }

  const required = getRequiredPermissionForPath(pathname);

  // Unknown dashboard path → deny
  if (required === undefined) {
    return <AccessDenied />;
  }

  // null → staff-only (already past StaffGuard)
  if (required !== null && !hasPermission(user, required)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center font-[family-name:var(--font-inter)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
        <ShieldAlert className="h-6 w-6 text-[var(--text-sub-500,#525866)]" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium text-[var(--text-main-900,#0A0D14)]">Access denied</h2>
        <p className="max-w-md text-sm text-[var(--text-sub-500,#525866)]">
          You do not have permission to view this page. Contact your administrator if you need access.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 text-sm font-medium text-white hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
