'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { isStaffUser } from '@/lib/auth-redirect';
import { isE2eAuthBypass } from '@/lib/e2e-auth';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

export function StaffGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, user, loading } = useAuth();

  const isAuthenticated = Boolean(session?.access_token || user);
  const awaitingProfile = Boolean(session?.access_token && !user);

  useEffect(() => {
    if (isE2eAuthBypass()) return;
    if (loading || awaitingProfile) return;
    if (!isAuthenticated) {
      // Full navigation avoids a soft-redirect loop that leaves the dashboard
      // shell mounted on skeletons after sign-out.
      window.location.assign('/login');
      return;
    }
    if (user && !isStaffUser(user.roles)) {
      router.replace('/portal');
    }
  }, [isAuthenticated, user, loading, awaitingProfile, router]);

  if (isE2eAuthBypass()) {
    return <>{children}</>;
  }

  if (loading || awaitingProfile || !user) {
    return <PageContentSkeleton />;
  }

  if (!isStaffUser(user.roles)) {
    return <PageContentSkeleton />;
  }

  return <>{children}</>;
}
