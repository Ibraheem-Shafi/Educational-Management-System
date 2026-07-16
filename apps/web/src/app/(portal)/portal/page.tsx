'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getPostLoginPath } from '@/lib/auth-redirect';

export default function PortalIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const roles = user.roles;
    if (roles.includes('student') && !roles.includes('parent')) {
      router.replace('/portal/student');
      return;
    }
    if (roles.includes('parent') && !roles.includes('student')) {
      router.replace('/portal/parent');
      return;
    }
    if (roles.includes('student') && roles.includes('parent')) {
      // Prefer student portal when dual-role; user can switch via nav if needed
      router.replace('/portal/student');
      return;
    }

    const path = getPostLoginPath(roles);
    router.replace(path.startsWith('/portal') ? path : '/portal/parent');
  }, [user, loading, router]);

  return (
    <p className="text-sm text-[var(--text-sub-500)] font-[family-name:var(--font-inter)]">
      Redirecting…
    </p>
  );
}
