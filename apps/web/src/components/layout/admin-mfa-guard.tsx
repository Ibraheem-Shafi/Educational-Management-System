'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { isDemoMfaSkipped, requiresMfaPolicy, resolveAdminMfaStep } from '@/lib/mfa';
import { isE2eAuthBypass } from '@/lib/e2e-auth';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

/** Blocks dashboard access until admin users satisfy MFA policy (enrolled + AAL2). */
export function AdminMfaGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const awaitingProfile = Boolean(session?.access_token && !user);

  useEffect(() => {
    if (isE2eAuthBypass()) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    if (loading || awaitingProfile) return;
    if (!user) {
      setChecking(false);
      return;
    }
    if (!requiresMfaPolicy(user.roles) || isDemoMfaSkipped()) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    const verify = async () => {
      const supabase = createClient();
      const step = await resolveAdminMfaStep(supabase, user.roles);
      if (step !== 'complete') {
        setChecking(false);
        router.replace('/login');
        return;
      }
      setAllowed(true);
      setChecking(false);
    };

    void verify();
  }, [user, loading, awaitingProfile, router]);

  if (isE2eAuthBypass()) {
    return <>{children}</>;
  }

  if (loading || awaitingProfile || checking) {
    return <PageContentSkeleton />;
  }

  if (user && requiresMfaPolicy(user.roles) && !allowed) {
    return <PageContentSkeleton />;
  }

  return <>{children}</>;
}
