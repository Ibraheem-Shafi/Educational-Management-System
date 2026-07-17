'use client';

import { Suspense } from 'react';
import { PortalPayFeePage } from '@/components/portal/portal-pay-fee-page';

export default function ParentPayFeePage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--text-sub-500)]">Loading…</p>}>
      <PortalPayFeePage returnPath="/portal/parent/fees" />
    </Suspense>
  );
}
