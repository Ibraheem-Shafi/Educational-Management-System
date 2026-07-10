'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InviteUserDialog } from '@/components/features/users/invite-user-dialog';

export default function InviteUserPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) router.push('/dashboard/users');
  }, [open, router]);

  return <InviteUserDialog open={open} onOpenChange={setOpen} />;
}
