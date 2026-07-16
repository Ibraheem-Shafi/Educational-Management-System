'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy modal route — redirect to list with create dialog. */
export default function NewBranchPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/branches?create=1');
  }, [router]);

  return null;
}
