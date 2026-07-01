import { Suspense } from 'react';
import { AcceptInviteForm } from './accept-invite-form';

export const dynamic = 'force-dynamic';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-muted-foreground">Loading...</p>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
