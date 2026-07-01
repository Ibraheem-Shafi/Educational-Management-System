'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getPostLoginPath } from '@/lib/auth-redirect';

export default function PortalIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const path = getPostLoginPath(user.roles);
    router.replace(path.startsWith('/portal') ? path : '/portal/parent');
  }, [user, loading, router]);

  return <p className="text-muted-foreground">Redirecting...</p>;
}
