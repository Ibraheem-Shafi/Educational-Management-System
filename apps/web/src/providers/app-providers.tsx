'use client';

import type { ReactNode } from 'react';
import type { AuthUser } from '@eims/types';
import { InstitutionProvider } from '@/providers/institution-provider';
import { AuthProvider } from '@/providers/auth-provider';

export function AppProviders({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  return (
    <InstitutionProvider>
      <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
    </InstitutionProvider>
  );
}
