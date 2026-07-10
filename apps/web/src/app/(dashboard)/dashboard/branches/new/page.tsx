'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddBranchDialog } from '@/components/features/branches/add-branch-dialog';

export default function NewBranchPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) router.push('/dashboard/branches');
  }, [open, router]);

  return <AddBranchDialog open={open} onOpenChange={setOpen} />;
}
