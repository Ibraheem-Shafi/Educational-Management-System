import { Suspense } from 'react';
import { AcceptInviteForm } from './accept-invite-form';

export const dynamic = 'force-dynamic';

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center font-[family-name:var(--font-inter)] text-[var(--text-sub-500,#525866)]">
          Loading...
        </p>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
