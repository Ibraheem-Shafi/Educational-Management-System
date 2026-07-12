'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy modal route — redirect to list with create dialog. */
export default function InviteUserPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/users?create=1');
  }, [router]);

  return null;
}
