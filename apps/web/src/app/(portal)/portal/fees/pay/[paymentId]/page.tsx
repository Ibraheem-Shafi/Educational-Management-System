'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { PortalPayFeePage } from '@/components/portal/portal-pay-fee-page';

function GenericPayFeePage() {
  const { user } = useAuth();
  const returnPath = user?.roles.includes('parent')
    ? '/portal/parent/fees'
    : '/portal/student/fees';

  return <PortalPayFeePage returnPath={returnPath} />;
}

export default function PortalFeesPayPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-sub-500)]">Loading…</p>}>
      <GenericPayFeePage />
    </Suspense>
  );
}
